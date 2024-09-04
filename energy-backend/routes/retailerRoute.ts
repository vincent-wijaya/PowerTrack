import express from 'express';
import moment from 'moment';
import { col, fn, literal, Op, where } from 'sequelize';

// Import the turf module for clustering
import * as turf from '@turf/turf';
import { Feature, FeatureCollection, Point, GeoJsonProperties } from 'geojson';
import { defineModels } from '../databaseModels';
import {
  OUTAGE_DURATION_THRESHOLD,
  OUTAGE_HP_DURATION_THRESHOLD,
} from '../utils/constants';
import {
  kWhConversionMultiplier,
  getTemporalGranularity,
} from '../utils/utils';

const router = express.Router();

type DbModelType = ReturnType<typeof defineModels>;

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

router.get('/consumption', async (req, res) => {
  // Retrieve energy consumption for a suburb or consumer over a period of time
  let { suburb_id, consumer_id, start_date, end_date } = req.query;
  const { sequelize, SuburbConsumption, ConsumerConsumption } =
    req.app.get('models');

  // If no date range is provided, return error 400
  if (!start_date) {
    return res.status(400).send({
      error: 'Start date must be provided.',
    });
  }

  // If no end date is provided, set it to the current date
  if (!end_date) {
    end_date = moment().toISOString();
  }

  // If start date format is invalid, return error 400 and check if time is included
  if (!moment(String(start_date), moment.ISO_8601, true).isValid()) {
    return res.status(400).send({
      error: 'Invalid start date format. Provide dates in ISO string format.',
    });
  }

  // If end date format is invalid, return error 400 and check if time is included
  if (!moment(String(end_date), moment.ISO_8601, true).isValid()) {
    return res.status(400).send({
      error: 'Invalid end date format. Provide dates in ISO string format.',
    });
  }

  // If the start date is after the end date, return error 400
  if (start_date > end_date) {
    return res.status(400).send({
      error: 'Invalid start date provided.',
    });
  }

  // Determine the date granularity based on the date range
  let dateGranularity: { name: string; sequelize: string } =
    getTemporalGranularity(String(start_date), String(end_date));
  let dateWhere: any = {};
  // Set the date range to be within the start and end dates
  dateWhere = {
    [Op.and]: {
      [Op.gt]: moment(String(start_date)).toISOString(),
      [Op.lte]: moment(String(end_date)).toISOString(),
    },
  };

  let consumptions;

  if (suburb_id && consumer_id) {
    return res.status(400).send({
      error: 'Cannot specify both suburb_id and consumer_id.',
    });
  } else if (suburb_id) {
    consumptions = await SuburbConsumption.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('amount')), 'amount'], // Averages the amount of energy generated
        [
          sequelize.fn(
            'date_trunc',
            dateGranularity.sequelize,
            sequelize.col('date')
          ),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      where: {
        suburb_id: suburb_id,
        date: dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });
  } else if (consumer_id) {
    consumptions = await ConsumerConsumption.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('amount')), 'amount'], // Averages the amount of energy consumed
        [
          sequelize.fn(
            'date_trunc',
            dateGranularity.sequelize,
            sequelize.col('date')
          ),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      where: {
        consumer_id: consumer_id,
        date: dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });
  } else {
    // Return nation-wide totals
    consumptions = await SuburbConsumption.findAll({
      attributes: [
        'suburb_id',
        [sequelize.fn('AVG', sequelize.col('amount')), 'amount'], // Averages the amount of energy consumed
        [
          sequelize.fn(
            'date_trunc',
            dateGranularity.sequelize,
            sequelize.col('date')
          ),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate', 'suburb_id'],
      where: {
        date: dateWhere,
      },
    });
  }

  // Prepare the data to be returned
  let returnData: any = {
    start_date: start_date,
    end_date: end_date,
    energy: [],
  };

  // Insert suburb_id or consumer_id to the return data (if provided)
  if (suburb_id) {
    returnData.suburb_id = Number(suburb_id);
  } else if (consumer_id) {
    returnData.consumer_id = Number(consumer_id);
  }

  // Extract the total generation value from the result
  consumptions.forEach((consumption: any) => {
    const date = moment(consumption.dataValues.truncatedDate).toISOString();

    // Add the date and amount of energy generated to the return data
    returnData.energy.push({
      date,
      amount:
        Number(consumption.dataValues.amount) *
        kWhConversionMultiplier(dateGranularity.name), // Converts the energy consumed into kWh based on the temporal granularity
    });
  });

  return res.status(200).send(returnData);
});

/**
 * GET /retailer/generation
 *
 * Retrieve average energy generation data for a suburb over a period of time in kWh.
 * Based on the time period, the data is aggregated by hour, day, or week.
 *
 * Query parameters:
 * - suburb_id: The ID of the suburb to retrieve data for.
 * - start_date: The start date of the period to retrieve data for, in ISO format
 * - end_date: The end date of the period to retrieve data for, in ISO format
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
router.get('/generation', async (req, res) => {
  try {
    let { suburb_id, start_date, end_date } = req.query; // Get query parameters
    let { sequelize, EnergyGeneration, EnergyGenerator } =
      req.app.get('models');

    // Define where clause for suburb (if provided)
    let suburbWhere: any = {};
    if (suburb_id) {
      // Check if suburb_id is an integer
      if (!Number.isInteger(Number(suburb_id))) {
        return res.status(400).send('Suburb ID must be an integer');
      }

      suburbWhere.suburb_id = suburb_id;
    }

    // If no date range is provided, return error 400
    if (!start_date)
      return res.status(400).send('Start date must be provided.');

    // If no end date is provided, set it to the current date
    if (!end_date) {
      end_date = moment().toISOString();
    }

    // If start date format is invalid, return error 400 and check if time is included
    if (!moment(String(start_date), moment.ISO_8601, true).isValid()) {
      return res
        .status(400)
        .send('Invalid start date format. Provide dates in ISO string format.');
    }

    // If end date format is invalid, return error 400 and check if time is included
    if (!moment(String(end_date), moment.ISO_8601, true).isValid()) {
      return res
        .status(400)
        .send('Invalid end date format. Provide dates in ISO string format.');
    }

    // If the start date is after the end date, return error 400
    if (start_date > end_date)
      return res.status(400).send('Invalid start date provided.');

    // Define where clause for date range
    let dateGranularity: { name: string; sequelize: string } =
      getTemporalGranularity(String(start_date), String(end_date));
    let dateWhere: any = {};
    // Set the date range to be within the start and end dates
    dateWhere.date = {
      [Op.and]: {
        [Op.gt]: moment(String(start_date)).toISOString(),
        [Op.lte]: moment(String(end_date)).toISOString(),
      },
    };

    // Retrieve energy generation data based on the date granularity
    const result = await EnergyGeneration.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('amount')), 'amount'], // Average the amount of energy generated
        [
          sequelize.fn(
            'date_trunc',
            dateGranularity.sequelize,
            sequelize.col('date')
          ),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      include: [
        {
          model: EnergyGenerator,
          attributes: [],
          where: suburbWhere,
        },
      ],
      where: {
        ...dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });

    // Prepare the data to be returned
    // The return data will be an object with the start date, end date, and energy data
    // The energy data is an array of [date, amount] pairs
    let returnData: any = {
      start_date: start_date,
      end_date: end_date,
      energy: [],
    };

    // Add suburb_id to the return data (if provided)
    if (suburb_id) {
      returnData.suburb_id = Number(suburb_id);
    }

    // Extract the total generation value from the result
    result.forEach((generation: any) => {
      const date = moment(generation.dataValues.truncatedDate).toISOString();

      // Add the date and amount of energy generated to the return data
      returnData.energy.push({
        date,
        amount:
          Number(generation.dataValues.amount) *
          kWhConversionMultiplier(dateGranularity.name), // Converts energy generation from kW to kWh based on temporal granularity
      });
    });

    return res.status(200).send(returnData);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal server error');
  }
});

/**
 * GET /retailer/generator
 *
 * Retrieve the energy generation of generators in a suburb over a period of time.
 * Based on the time period, the data is aggregated by hour, day, or week.
 *
 * Query parameters:
 * - suburb_id: The ID of the suburb to retrieve data for. If not provided, data for all suburbs will be retrieved.
 * - start_date: The start date of the period to retrieve data for in ISO format. Must be provided.
 * - end_date: The end date of the period to retrieve data for in ISO format. If not provided, the current date will be used.
 *
 * Response format:
 * {
 *   suburb_id: number, // The ID of the suburb (if provided)
 *   start_date: string, // The start date input
 *   end_date: string, // The end date input (now if not provided)
 *   energy: [ { date: string, amount: number }, ... ] // An array of { date: string, amount: number } objects of the date converted based on granularity and the amount of energy generated.
 * }
 * Response format:
 *  {
 *    suburb_id: number, // The ID of the suburb (if provided)
 *    generators: [
 *      {
 *        energy_generator_id: number, // The ID of the energy generator
 *        energy: [
 *          { date: string, amount: number },  // An array of { date: string, amount: number } objects of the date converted based on granularity and the amount of energy generated.
 *        ]
 *      },
 *      ...
 *    ]
 *  }
 *
 * Example response (hourly time granularity):
 *  {
 *    suburb_id: 1,
 *    start_date: '2024-01-01T05:00:00Z',
 *    end_date: '2024-01-01T10:00:00Z',
 *    generators: [
 *      {
 *        energy_generator_id: 1,
 *        energy: [
 *          {
 *            date: '2024-01-01T08:00:00Z',
 *            amount: 1000,
 *          },
 *        ]
 *      },
 *    ]
 *  }
 *
 */
router.get('/generator', async (req, res) => {
  try {
    let { suburb_id, start_date, end_date } = req.query;
    const { sequelize, EnergyGeneration, EnergyGenerator } =
      req.app.get('models');

    // Define where clause for suburb_id
    const suburbWhere: any = {};
    if (suburb_id) {
      // Check if suburb_id is a whole number
      if (!Number.isInteger(Number(suburb_id))) {
        return res.status(400).send('Suburb ID must be an integer');
      }

      suburbWhere.suburb_id = suburb_id;
    } else {
      suburbWhere.suburb_id = {
        [Op.ne]: null,
      };
    }

    // Determine the date granularity based on the date range
    let dateGranularity: { name: string; sequelize: string } =
      getTemporalGranularity(String(start_date), String(end_date));
    let dateWhere: any = {};

    // If start_date is not provided, return error 400
    if (!start_date) {
      return res.status(400).send('Start date must be provided.');
    }

    // If end_date is not provided, set it to the current date
    if (!end_date) {
      end_date = new Date().toISOString();
    }

    // If start date format is invalid, return error 400 and check if time is included
    if (!moment(String(start_date), moment.ISO_8601, true).isValid()) {
      return res
        .status(400)
        .send('Invalid start date format. Provide dates in ISO string format.');
    }

    // If end date format is invalid, return error 400 and check if time is included
    if (!moment(String(end_date), moment.ISO_8601, true).isValid()) {
      return res
        .status(400)
        .send('Invalid end date format. Provide dates in ISO string format.');
    }

    // If start_date is after end_date, return error 400
    if (start_date > end_date) {
      return res.status(400).send('Invalid start date provided.');
    }

    // Set the date range to be between the two dates
    dateWhere.date = {
      [Op.and]: {
        [Op.gt]: new Date(String(start_date)),
        [Op.lte]: new Date(String(end_date)),
      },
    };

    // Retrieve energy generation data based on the date granularity
    const result = await EnergyGeneration.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('amount')), 'amount'], // Averages the amount of energy generated
        [
          sequelize.fn(
            'date_trunc',
            dateGranularity.sequelize,
            sequelize.col('date')
          ),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
        'energy_generator_id', // Include the energy generator ID
      ],
      group: ['truncatedDate', 'energy_generator_id'],
      include: [
        {
          model: EnergyGenerator,
          attributes: [],
          where: suburbWhere,
        },
      ],
      where: {
        ...dateWhere,
      },
      order: [
        ['truncatedDate', 'ASC'],
        ['energy_generator_id', 'ASC'],
      ],
    });

    // Prepare the data to be returned
    // The return data will be an object with the start date, end date, and energy data
    // The energy data is an array of [date, amount] pairs
    let returnData: any = {
      start_date,
      end_date,
      generators: [],
    };

    // Add suburb_id to the return data (if provided)
    if (suburb_id) {
      returnData.suburb_id = Number(suburb_id);
    }

    // This section groups the energy generation data by energy generator
    // Cycles through each energy generation and appends it to the array of the corresponding energy generator
    result.forEach((generator: any) => {
      const generatorId = generator.dataValues.energy_generator_id;
      const date = moment(generator.dataValues.truncatedDate).toISOString();
      const amount =
        Number(generator.dataValues.amount) *
        kWhConversionMultiplier(dateGranularity.name); // Convert energy generated into kWh based on the temporal granularity

      // If the generator ID is not in the return data, add it
      // Adds the generator ID and an empty array for the energy data
      if (!returnData.generators[generatorId]) {
        returnData.generators[generatorId] = {
          energy_generator_id: Number(generatorId),
          energy: [],
        };
      }

      // Add the energy generation data to the gemerator's array of energy data
      returnData.generators[generatorId].energy.push({
        date,
        amount,
      });
    });

    // Convert the generators object to an array
    returnData.generators = Object.values(returnData.generators);

    return res.status(200).send(returnData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});

router.get('/profitMargin', async (req, res) => {
  const { start_date, end_date } = req.query;
  const { SpotPrice, SellingPrice } = req.app.get('models');

  if (
    (start_date && isNaN(new Date(String(start_date)).getTime())) ||
    (end_date && isNaN(new Date(String(end_date)).getTime()))
  ) {
    return res
      .status(400)
      .send('Invalid date format. Provide dates in ISO string format.');
  }

  let date_where_clause: any = {
    [Op.ne]: null,
  };
  if (start_date) {
    date_where_clause[Op.gt] = new Date(String(start_date));
  }
  if (end_date) {
    date_where_clause[Op.lte] = new Date(String(end_date));
  }

  let sellingPrices = await SellingPrice.findAll({
    where: {
      date: date_where_clause,
    },
  });

  let spotPrices = await SpotPrice.findAll({
    where: {
      date: date_where_clause,
    },
  });

  spotPrices.sort((a: any, b: any) => {
    return new Date(a.date).valueOf() - new Date(b.date).valueOf();
  });
  sellingPrices.sort((a: any, b: any) => {
    return new Date(a.date).valueOf() - new Date(b.date).valueOf();
  });

  spotPrices = spotPrices.map((spotPrice: any) => ({
    date: spotPrice.date.toISOString(),
    amount: Number(spotPrice.amount),
  }));
  sellingPrices = sellingPrices.map((sellingPrice: any) => ({
    date: sellingPrice.date.toISOString(),
    amount: Number(sellingPrice.amount),
  }));

  return res.status(200).send({
    spot_prices: spotPrices,
    selling_prices: sellingPrices,
  });
});

router.get('/warnings', async (req, res) => {
  // Retrieve warnings for a suburb
  const { suburb_id, consumer_id } = req.query;
  const {
    sequelize,
    Consumer,
    ConsumerConsumption,
    GoalType,
    SellingPrice,
    WarningType,
    SuburbConsumption,
    EnergyGeneration,
    EnergyGenerator,
  } = req.app.get('models') as DbModelType;

  // Get goal types
  const goalTarget = consumer_id ? 'consumer' : 'retailer';
  const goalTypes = await GoalType.findAll({
    where: {
      target_type: goalTarget,
    },
  });
  if (goalTypes.length === 0) {
    return res.status(501).send('No goal types found');
  }

  // Get warning types
  const warningTypes = await Promise.all(
    goalTypes.map(async (goalType: any) => {
      return await goalType.getWarning_types();
    })
  ).then((result) => result.flat());
  if (warningTypes.length === 0) {
    return res.status(501).send('No warning types found');
  }

  /**
   * Gets the ratio of energy consumed / energy generated in the past 24 hours for a given suburb.
   * If no energy generation in the area in the last 24 hours, returns null
   * @param suburb_id Can be undefined to indicate nation-wide data
   * @returns energy utilised ratio for a given suburb as a decimal. If a suburb_id is not provided, returns nation-wide utilised ratio.
   */
  const getEnergyUtilisedRatio = async (suburb_id: number | undefined) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Fetch total consumption in the past 24 hours
    const consumptionPastDay = await SuburbConsumption.sum('amount', {
      where: suburb_id
        ? {
            suburb_id: suburb_id,
            date: { [Op.gte]: yesterday },
          }
        : {
            date: { [Op.gte]: yesterday },
          },
    });

    // Fetch total generation in the past 24 hours
    const generationPastDay = (
      await EnergyGeneration.findAll({
        include: [
          {
            model: EnergyGenerator,
            where: suburb_id ? { suburb_id: suburb_id } : {},
          },
        ],
        where: {
          date: { [Op.gte]: yesterday },
        },
      })
    ).reduce((prev, cur) => prev + parseFloat(cur.amount), 0); // Add the amounts of all generation records

    if (generationPastDay === 0) return null;

    return consumptionPastDay / generationPastDay;
  };

  // Iterate through each warning type
  let warnings: any[] = [];
  for (const warningType of warningTypes) {
    switch (warningType.category) {
      // Add a case for each warning type
      // Check for each type of warning whether the warning should be triggered
      // If triggered, add the warning data to the warnings array
      case 'outage_hp':
        const whereClause: any = {
          high_priority: true,
        };

        if (suburb_id) {
          whereClause.suburb_id = suburb_id;
        }

        const consumers = await Consumer.findAll({
          attributes: [
            'id',
            'street_address',
            [
              sequelize.fn(
                'SUM',
                sequelize.col('consumer_consumptions.amount')
              ),
              'total_amount',
            ],
          ],
          where: {
            ...whereClause,
          },
          include: [
            {
              model: ConsumerConsumption,
              attributes: [], // We don't need to return details of ConsumerConsumption
              where: {
                date: {
                  [Op.gt]: moment()
                    .subtract(OUTAGE_HP_DURATION_THRESHOLD, 'minutes')
                    .toISOString(),
                },
              },
              required: false, // Perform a LEFT JOIN to include consumers even without ConsumerConsumption records
            },
          ],
          group: ['consumer.id', 'consumer.street_address'],
          having: sequelize.literal(
            'SUM(consumer_consumptions.amount) IS NULL OR SUM(consumer_consumptions.amount) = 0'
          ), // Filter out consumers with non-zero consumption
          order: [['id', 'ASC']],
        });

        for (const consumer of consumers) {
          warnings.push({
            category: warningType.category,
            description: warningType.description,
            data: {
              consumer_id: Number(consumer.id),
              street_address: consumer.street_address,
            },
            suggestion: `Prioritise re-establishing energy for priority consumer at address ${consumer.street_address}.`,
          });
        }

        break;
      case 'high_cost':
        // Get the latest selling price
        const sellingPrice = await SellingPrice.findOne({
          order: [['date', 'DESC']],
        });
        if (!sellingPrice) {
          console.error('No selling price found!');
          break;
        }
        if (sellingPrice.amount >= warningType.target) {
          warnings.push({
            category: warningType.category,
            description: warningType.description,
            data: {
              energy_cost: sellingPrice.amount,
            },
            suggestion: `Energy cost is at $${sellingPrice.amount}/kWh, so use less energy to save money.`,
          });
        }
        break;
      case 'low_usage':
        {
          const energyUtilisedRatio = await getEnergyUtilisedRatio(
            parseInt(suburb_id as string) || undefined
          );
          if (
            energyUtilisedRatio &&
            energyUtilisedRatio <= parseFloat(warningType.target)
          ) {
            warnings.push({
              category: warningType.category,
              description: warningType.description,
              data: { energy_utilised_percentage: energyUtilisedRatio },
              suggestion: `Only ${(energyUtilisedRatio * 100).toFixed(1)}% of the energy generated in the last 24 hours has been used. Advise AEMO to generate less energy or incentivise customers to consume more energy.`,
            });
          }
        }
        break;
      case 'high_usage':
        {
          const energyUtilisedRatio = await getEnergyUtilisedRatio(
            parseInt(suburb_id as string) || undefined
          );

          if (
            energyUtilisedRatio &&
            energyUtilisedRatio >= parseFloat(warningType.target)
          ) {
            warnings.push({
              category: warningType.category,
              description: warningType.description,
              data: { energy_utilised_percentage: energyUtilisedRatio },
              suggestion: `${(energyUtilisedRatio * 100).toFixed(1)}% of the energy generated in the last 24 hours has been used. Advise AEMO to generate more energy.`,
            });
          }
        }
        break;
      default:
        console.error(`Unsupported warning category: ${warningType.category}`);
    }
  }

  res.send({
    warnings: warnings,
  });
});

router.get('/consumers', async (req, res) => {
  // Retrieve consumers by suburb_id or consumer by consumer_id or all consumers
  const { suburb_id, consumer_id } = req.query;
  const { Consumer, Suburb } = req.app.get('models');

  let consumers;

  if (suburb_id && consumer_id) {
    return res
      .status(400)
      .send('Cannot specify both suburb_id and consumer_id');
  } else if (suburb_id) {
    // Return consumers by suburb_id
    consumers = await Consumer.findAll({
      where: {
        suburb_id: suburb_id,
      },
      include: [
        {
          model: Suburb,
          attributes: ['name', 'postcode'], // Include name and post_code attributes
        },
      ],
    });
  } else if (consumer_id) {
    // Return specific consumer
    consumers = await Consumer.findAll({
      where: {
        id: consumer_id,
      },
      include: [
        {
          model: Suburb,
          attributes: ['name', 'postcode'], // Include name and post_code attributes
        },
      ],
    });
  } else {
    // Return all consumers
    consumers = await Consumer.findAll({
      include: [
        {
          model: Suburb,
          attributes: ['name', 'postcode'], // Include name and post_code attributes
        },
      ],
    });
  }

  // Transform response to the desired format
  const formattedConsumers = consumers.map((consumer: any) => {
    return {
      id: consumer.id,
      high_priority: consumer.high_priority,
      address: consumer.street_address,
      suburb_id: consumer.suburb_id,
      suburb_name: consumer.suburb.name,
      suburb_post_code: consumer.suburb.postcode,
    };
  });

  res.send({
    consumers: formattedConsumers,
  });
});

router.get('/suburbs', async (req, res) => {
  const { sequelize, Suburb } = req.app.get('models');

  try {
    const suburbs = await Suburb.findAll();
    res.send({
      suburbs: suburbs,
    });
  } catch (error) {
    res.status(500).send({
      error: 'An error occurred while fetching suburbs',
    });
  }
});

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
              [Op.gt]: moment()
                .subtract(OUTAGE_DURATION_THRESHOLD, 'minutes')
                .toISOString(),
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
      ],
      having: literal(
        'SUM(consumer_consumptions.amount) IS NULL OR SUM(consumer_consumptions.amount) = 0'
      ), // Filter out consumers with non-zero consumption
      order: [['id', 'ASC']],
    })) as unknown as {
      id: string;
      street_address: string;
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
              [Op.gt]: moment()
                .subtract(OUTAGE_HP_DURATION_THRESHOLD, 'minutes')
                .toISOString(),
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
      ],
      having: literal(
        'SUM(consumer_consumptions.amount) IS NULL OR SUM(consumer_consumptions.amount) = 0'
      ), // Filter out consumers with non-zero consumption
      order: [['id', 'ASC']],
    })) as unknown as {
      id: string;
      street_address: string;
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
    const clusterFeatures = turf.clustersDbscan(pointCollection, PROXIMITY, {
      minPoints: MIN_POINTS,
      units: 'kilometers',
    });

    type ConsumerInstance = InstanceType<typeof Consumer>;

    // Define the data structure for the cluster data
    const clusterMap = new Map<number, { consumers: ConsumerInstance[] }>(); // Map to store clusters of outages
    const consumerOutages: ConsumerInstance[] = []; // Array to store all consumers in outage clusters

    // Iterate through the clustered features and group consumers by cluster
    (
      clusterFeatures.features as Feature<
        Point,
        {
          consumer_id: number;
          street_address: string;
          high_priority: boolean;
          cluster?: number;
        }
      >[]
    ).forEach((feature) => {
      const clusterId = feature.properties.cluster;

      // Extract consumer data from the feature properties
      const consumerData: ConsumerInstance = Consumer.build({
        id: Number(feature.properties.consumer_id),
        street_address: feature.properties.street_address,
        latitude: String(feature.geometry.coordinates[1]),
        longitude: String(feature.geometry.coordinates[0]),
        high_priority: Boolean(feature.properties.high_priority),
      });

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
        const consumerData: ConsumerInstance = Consumer.build({
          id: Number(consumer.id),
          street_address: consumer.street_address,
          latitude: consumer.latitude,
          longitude: consumer.longitude,
          high_priority: Boolean(consumer.high_priority),
        });

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

export default router;
