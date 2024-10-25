import express from 'express';
import { col, fn, literal, Op } from 'sequelize';

// Import the turf module for clustering
import { clustersDbscan } from '@turf/turf';
import { Feature, FeatureCollection, Point, GeoJsonProperties } from 'geojson';
import { defineModels } from '../databaseModels';
import {
  OUTAGE_DURATION_THRESHOLD,
  OUTAGE_HP_DURATION_THRESHOLD,
} from '../utils/constants';
import { validateDateInputs, isValidId } from '../utils/utils';
import { subMinutes } from 'date-fns';

import { getEnergyConsumption } from '../utils/dbUtils';

const router = express.Router();

type DbModelType = ReturnType<typeof defineModels>;

/**
 * GET /retailer/powerOutages
 *
 * Retrieve power outages data for consumers.
 *
 * A region is considered to have a power outage if multiple consumers (at least 2)
 * within 1 km of one another have zero energy consumption for a 30-minute period.
 *
 * Returns a list of consumers with power outages and clusters of consumers with power outages
 * within 1 km from one another.
 *
 * Response format:
 * {
 * power_outages: {
 *   consumers: [
 *      {
 *          id: number, // The ID of the consumer
 *          street_address: string, // The street address of the consumer
 *          latitude: string, // The latitude of the consumer
 *          longitude: string, // The longitude of the consumer
 *          high_priority: boolean, // Whether the consumer is high priority
 *      },
 *      ...
 *   ],
 *   clusters: [
 *      {
 *          consumers: [
 *             {
 *                 id: number, // The ID of the consumer
 *                 street_address: string, // The street address of the consumer
 *                 latitude: string, // The latitude of the consumer
 *                 longitude: string, // The longitude of the consumer
 *                 high_priority: boolean, // Whether the consumer is high priority
 *             },
 *             ...
 *          ],
 *      },
 *      ...
 *    ],
 * }
 */
router.get('/powerOutages', async (req, res) => {
  const { Consumer, ConsumerConsumption } = req.app.get(
    'models'
  ) as DbModelType;

  interface ConsumerData {
    id: number;
    street_address: string;
    suburb_id: number;
    latitude: number;
    longitude: number;
    high_priority: boolean;
  }

  // Retrieve consumers with zero consumption for the past 30 minutes
  try {
    // Retrieve list of consumers that have logged data to filter out consumers that have not been connected to the power grid yet.
    const consumersWithData = await Consumer.findAll({
      attributes: ['id'],
      include: [
        {
          model: ConsumerConsumption,
          attributes: [],
          required: true,
        },
      ],
      group: ['consumer.id'],
      order: [['id', 'ASC']],
    });

    const regularOutages = (await Consumer.findAll({
      attributes: [
        'id',
        'street_address',
        'longitude',
        'latitude',
        'high_priority',
        'suburb_id',
        [fn('SUM', col('consumer_consumptions.amount')), 'total_amount'],
      ],
      where: {
        high_priority: false,
        id: {
          [Op.in]: consumersWithData.map((c: { id: number }) => {
            return c.id;
          }),
        },
      },
      include: [
        {
          model: ConsumerConsumption,
          attributes: [], // We don't need to return details of ConsumerConsumption
          where: {
            date: {
              [Op.gt]: subMinutes(
                new Date(),
                OUTAGE_DURATION_THRESHOLD
              ).toISOString(),
            },
          },
          required: false, // Perform a LEFT JOIN to include consumers even without ConsumerConsumption records
        },
      ],
      group: [
        'consumer.id',
        'consumer.street_address',
        'consumer.longitude',
        'consumer.latitude',
        'consumer.suburb_id',
      ],
      having: literal(
        'SUM(consumer_consumptions.amount) IS NULL OR SUM(consumer_consumptions.amount) = 0'
      ), // Filter out consumers with non-zero consumption
      order: [['id', 'ASC']],
    })) as unknown as {
      id: number;
      street_address: string;
      suburb_id: number;
      longitude: string;
      latitude: string;
      high_priority: boolean;
      total_amount: number;
    }[];

    // Retrieve high priority consumers with zero consumption for the past 5 minutes
    const highPriorityOutages = (await Consumer.findAll({
      attributes: [
        'id',
        'street_address',
        'longitude',
        'latitude',
        'high_priority',
        'suburb_id',
        [fn('SUM', col('consumer_consumptions.amount')), 'total_amount'],
      ],
      where: {
        high_priority: true,
        id: {
          [Op.in]: consumersWithData.map((c: { id: any }) => {
            return c.id;
          }),
        },
      },
      include: [
        {
          model: ConsumerConsumption,
          attributes: [], // We don't need to return details of ConsumerConsumption
          where: {
            date: {
              [Op.gt]: subMinutes(
                new Date(),
                OUTAGE_HP_DURATION_THRESHOLD
              ).toISOString(),
            },
          },
          required: false, // Perform a LEFT JOIN to include consumers even without ConsumerConsumption records
        },
      ],
      group: [
        'consumer.id',
        'consumer.street_address',
        'consumer.longitude',
        'consumer.latitude',
        'consumer.suburb_id',
      ],
      having: literal(
        'SUM(consumer_consumptions.amount) IS NULL OR SUM(consumer_consumptions.amount) = 0'
      ), // Filter out consumers with non-zero consumption
      order: [['id', 'ASC']],
    })) as unknown as {
      id: number;
      street_address: string;
      suburb_id: number;
      longitude: string;
      latitude: string;
      high_priority: boolean;
      total_amount: number;
    }[];

    // Combine regular and high priority outages
    const allOutages = regularOutages.concat(highPriorityOutages);

    // Create a FeatureCollection from the results to be used for clustering
    const features: Feature<Point, GeoJsonProperties>[] = allOutages.map(
      (consumer) => ({
        type: 'Feature',
        properties: {
          consumer_id: consumer.id,
          street_address: consumer.street_address,
          high_priority: consumer.high_priority,
          suburb_id: consumer.suburb_id,
        },
        geometry: {
          type: 'Point',
          coordinates: [Number(consumer.longitude), Number(consumer.latitude)],
        },
      })
    );

    const pointCollection: FeatureCollection<Point, GeoJsonProperties> = {
      type: 'FeatureCollection',
      features: features,
    };

    // Perform clustering
    const PROXIMITY = 1; // Maximum distance between points in a cluster
    const MIN_POINTS = 2; // Minimum number of points to form a cluster
    const clusterFeatures = clustersDbscan(pointCollection, PROXIMITY, {
      minPoints: MIN_POINTS,
      units: 'kilometers',
    });

    // Define the data structure for the cluster data
    const clusterMap = new Map<number, { consumers: ConsumerData[] }>(); // Map to store clusters of outages
    const consumerOutages: ConsumerData[] = []; // Array to store all consumers in outage clusters

    // Iterate through the clustered features and group consumers by cluster
    (
      clusterFeatures.features as Feature<
        Point,
        {
          consumer_id: number;
          street_address: string;
          high_priority: boolean;
          suburb_id: number;
          cluster?: number;
        }
      >[]
    ).forEach((feature) => {
      const clusterId = feature.properties.cluster;

      // Extract consumer data from the feature properties
      const consumerData: ConsumerData = {
        id: Number(feature.properties.consumer_id),
        street_address: feature.properties.street_address,
        suburb_id: Number(feature.properties.suburb_id),
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
        high_priority: Boolean(feature.properties.high_priority),
      };

      // Skip if feature is not part of a cluster
      if (clusterId === undefined) {
        return;
      }

      // Create a new cluster if it doesn't exist
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, {
          consumers: [],
        });
      }

      // Store the consumer data properties in the cluster and the consumerOutages array
      consumerOutages.push(consumerData);
      clusterMap.get(clusterId)?.consumers.push(consumerData);
    });

    // Convert clusterMap into an array
    let clusters = Array.from(clusterMap.values());

    // Add high priority outages that are not part of a cluster
    highPriorityOutages.forEach((consumer) => {
      if (
        consumerOutages.find((c) => c.id === Number(consumer.id)) === undefined
      ) {
        const consumerData: ConsumerData = {
          id: Number(consumer.id),
          street_address: consumer.street_address,
          suburb_id: Number(consumer.suburb_id),
          latitude: Number(consumer.latitude),
          longitude: Number(consumer.longitude),
          high_priority: Boolean(consumer.high_priority),
        };

        consumerOutages.push(consumerData); // Add to list of consumers with outages
        // Add high priority consumer to its own cluster
        clusters.push({
          consumers: [consumerData],
        });
      }
    });

    // Return the power outages data
    return res.status(200).send({
      power_outages: {
        consumers: consumerOutages.sort((a, b) => a.id - b.id), // Sort consumers by ID
        clusters,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});

router.get('/map', async (req, res) => {
  // Retrieve the last energy consumption record (kW) of each suburb. Optionally limit the area of the map to the bounding box defined by 2 coordinate points (top-left and bottom-right).
  const { lat1, long1, lat2, long2 } = req.query;
  let whereClause;

  // Get relevant suburbs
  if (lat1 && long1 && lat2 && long2) {
    whereClause = {
      latitude: {
        [Op.between]: [lat1, lat2],
      },
      longitude: {
        [Op.between]: [long1, long2],
      },
    };
  } else {
    whereClause = {};
  }

  // Get all suburbs within the bounding box
  let suburbs = await req.app.get('models').Suburb.findAll({
    where: whereClause,
  });

  // Get the latest timestamp for each suburb
  let latestConsumptions = await req.app.get('models').sequelize.query(
    `
      SELECT * FROM (
        SELECT 
          *, 
          ROW_NUMBER() OVER (PARTITION BY suburb_id ORDER BY date DESC) AS rn
        FROM 
          suburb_consumption
        WHERE 
          suburb_id IN (:suburbIds)
      ) AS latest
      WHERE rn = 1;
    `,
    {
      replacements: { suburbIds: suburbs.map((suburb: any) => suburb.id) },
      type: req.app.get('models').sequelize.QueryTypes.SELECT,
    }
  );

  // Return the energy consumption for each suburb
  res.status(200).send({
    energy: latestConsumptions.map((consumption: any) => {
      return {
        suburb_id: consumption.suburb_id,
        consumption: consumption.amount,
        timestamp: latestConsumptions[0].date,
      };
    }),
  });
});

/**
 * GET /retailer/consumption
 *
 * Retrieve average energy consumption data for a suburb/consumer/nationwide over a period of time in kWh.
 * Based on the time period, the data is aggregated by hour, day, or week.
 *
 * Query parameters:
 * - suburb_id: The ID of the suburb to retrieve data for. (optional)
 * - consumer_id: The ID of the consumer to retrieve data for. (optional)
 * - start_date: The start date of the period to retrieve data for, in ISO format
 * - end_date: The end date of the period to retrieve data for, in ISO format (optional)
 *
 * Response format:
 * {
 *   suburb_id: number, // The ID of the suburb (if provided)
 *   start_date: string, // The start date input
 *   end_date: string, // The end date input (now if not provided)
 *   energy: [
 *     { date: string, amount: number }, // An array of { date: string, amount: number } objects of the date converted based on granularity and the amount of energy generated.
 *   ]
 * }
 *
 * Example response:
 * {
 *   suburb_id: 1,
 *   start_date: '2024-01-01T05:00:00Z',
 *   end_date: '2024-01-01T10:00:00Z',
 *   energy: [
 *     {
 *         date: '2024-01-01T08:00:00Z',
 *         amount: 1000,
 *     },
 *     ...
 *   ]
 * }
 */
router.get('/consumption', async (req, res) => {
  // Retrieve energy consumption for a suburb or consumer over a period of time
  const { suburb_id, consumer_id, start_date, end_date } = req.query;
  const models = req.app.get('models');

  if (suburb_id && consumer_id) {
    return res.status(400).send({
      error: 'Cannot specify both suburb_id and consumer_id.',
    });
  }

  // Check if suburb_id is an integer
  if (suburb_id && !isValidId(Number(suburb_id))) {
    return res.status(400).send('Suburb ID must be an integer');
  }

  // Check if consumer_id is an integer
  if (consumer_id && !isValidId(Number(consumer_id))) {
    return res.status(400).send('Consumer ID must be an integer');
  }

  const { data: dates, error: dateError } = validateDateInputs(
    String(start_date),
    String(end_date)
  );

  if (dateError) {
    return res.status(dateError.status).json({
      error: dateError.message,
    });
  }

  const consumption = await getEnergyConsumption(
    models,
    dates.startDate,
    dates.endDate,
    Number(suburb_id),
    Number(consumer_id)
  );

  return res.status(200).send({
    start_date,
    end_date,
    ...(suburb_id && { suburb_id: Number(suburb_id) }),
    ...(consumer_id && { consumer_id: Number(consumer_id) }),
    energy: consumption,
  });
});

export default router;
