import express from 'express';
import moment, { Moment } from 'moment';
import { col, fn, literal, Op } from 'sequelize';

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
import {
  addDays,
  addHours,
  addWeeks,
  differenceInHours,
  formatISO,
  isBefore,
  isValid,
  min,
  parse,
  startOfDay,
  startOfHour,
  startOfISOWeek,
} from 'date-fns';
import { Consumer } from 'kafkajs';

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
  let { suburb_id, consumer_id, start_date, end_date } = req.query;
  const { SuburbConsumption, ConsumerConsumption } = req.app.get('models');

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
        [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy generated
        [
          fn('date_trunc', dateGranularity.sequelize, col('date')),
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
        [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy consumed
        [
          fn('date_trunc', dateGranularity.sequelize, col('date')),
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
        [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy consumed
        [
          fn('date_trunc', dateGranularity.sequelize, col('date')),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      where: {
        date: dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
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

  // Extract the total consumption value from the result
  consumptions.forEach((consumption: any) => {
    const date = moment(consumption.dataValues.truncatedDate).toISOString();

    // Add the date and amount of energy consumed to the return data
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
        [Op.gt]: new Date(String(start_date)).toISOString(),
        [Op.lte]: new Date(String(end_date)).toISOString(),
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

    // Determine the date granularity based on the date range
    let dateGranularity: { name: string; sequelize: string } =
      getTemporalGranularity(String(start_date), String(end_date));
    let dateWhere: any = {};

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

/**
 * GET /retailer/profitMargin
 *
 * Calls getProfitMargin function.
 *
 * Query parameters:
 * - start_date: The start date of the period to retrieve data for, in ISO format
 * - end_date: The end date of the period to retrieve data for, in ISO format (optional)
 *
 * Response format:
 * {
 *   start_date: string,
 *   end_date: string,
 *   values: [
 *     {
 *         selling_prices: [
 *             {
 *                date: string,
 *                amount: number
 *             }
 *         ],
 *         spot_prices: [
 *             {
 *                date: string,
 *                amount: number
 *             }
 *         ],
 *         profits: [
 *             {
 *                date: string,
 *                amount: number
 *             }
 *         ]
 *     },
 *   ]
 * }
 *
 * Example response:
 * {
 *   start_date: '2024-01-01T00:00:00.000Z',
 *   end_date: '2024-01-02T00:00:00.000Z',
 *   values: [
 *     {
 *         selling_prices: [
 *             {
 *                date: '2024-01-01T00:00:00.000Z',
 *                amount: 100
 *             }
 *         ],
 *         spot_prices: [
 *             {
 *                date: '2024-01-01T00:00:00.000Z',
 *                amount: 70
 *             }
 *         ],
 *         profits: [
 *             {
 *                date: '2024-01-01T00:00:00.000Z',
 *                amount: 30
 *             }
 *         ]
 *     },
 *   ]
 * }
 */
router.get('/profitMargin', async (req, res) => {
  let { start_date, end_date } = req.query;
  const db = req.app.get('models');

  // If no date range is provided, return error 400
  if (!start_date) {
    return res.status(400).send({
      error: 'Start date must be provided.',
    });
  }

  // Validate format of start_date
  const parsedStartDate = parse(
    String(start_date),
    "yyyy-MM-dd'T'HH:mm:ss.SSSX",
    new Date()
  );
  if (!isValid(parsedStartDate)) {
    return res.status(400).send({
      error: 'Invalid start date format. Provide dates in ISO string format.',
    });
  }

  let parsedEndDate;
  if (end_date) {
    // Validate format of end_date
    parsedEndDate = parse(
      String(end_date),
      "yyyy-MM-dd'T'HH:mm:ss.SSSX",
      new Date()
    );

    if (!isValid(parsedEndDate)) {
      return res.status(400).send({
        error: 'Invalid end date format. Provide dates in ISO string format.',
      });
    }
  } else {
    // Set end_date to now if not provided
    parsedEndDate = new Date();
  }

  // Validate that end_date is after start_date
  if (isBefore(parsedEndDate, parsedStartDate)) {
    return res
      .status(400)
      .send({ error: 'Start date must be before end date.' });
  }

  if (isBefore(new Date(), parsedEndDate)) {
    return res
      .status(400)
      .send({ error: 'End date must not be in the future.' });
  }

  const prices = await getProfitMargin(db, parsedStartDate, parsedEndDate);

  return res.status(200).send({
    start_date,
    end_date,
    values: {
      spot_prices: prices.spotPrices,
      selling_prices: prices.sellingPrices,
      profits: prices.profits,
    },
  });
});

/**
 *
 * @param db Retrieve the average spot prices, selling prices, and profits (derived from selling price - spot price) during a given period of time.
 * Based on the time period, the data is aggregated by hour, day, or week. Profit is only calculated on dates that contain a selling price
 * or spot price. If a date is missing one of the price values, the previous value is used instead to calculate the profit of the particular
 * date.
 *
 * @param startDate start of date range
 * @param endDate end of date range
 * @returns arrays of selling price, spot price, and profit data
 */
const getProfitMargin = async (
  db: DbModelType,
  startDate: Date,
  endDate: Date
) => {
  const { SellingPrice, SpotPrice } = db;

  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  // Determine the date granularity based on the date range
  let dateGranularity = getTemporalGranularity(
    startDate.toISOString(),
    endDate.toISOString()
  );

  interface Price {
    date: string;
    amount: number;
  }

  let sellingPricesData = (await SellingPrice.findAll({
    attributes: [
      [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy generated
      [
        fn('date_trunc', dateGranularity.sequelize, col('date')),
        'truncatedDate',
      ], // Truncate the date based on the date granularity
    ],
    group: ['truncatedDate'],
    where: {
      date: dateWhere,
    },
    order: [['truncatedDate', 'ASC']],
  })) as unknown as {
    date?: string;
    truncatedDate?: string;
    amount: number;
  }[];

  let spotPricesData = await SpotPrice.findAll({
    attributes: [
      [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy generated
      [
        fn('date_trunc', dateGranularity.sequelize, col('date')),
        'truncatedDate',
      ], // Truncate the date based on the date granularity
    ],
    group: ['truncatedDate'],
    where: {
      date: dateWhere,
    },
    order: [['truncatedDate', 'ASC']],
  });

  // Return empty arrays if no data is retrieved
  if (sellingPricesData.length === 0 && spotPricesData.length === 0) {
    return {
      spotPrices: [],
      sellingPrices: [],
      profits: [],
    };
  }

  // Get the last value before the query period if there are no selling/spot price data in this search
  if (sellingPricesData.length === 0) {
    const singleSellingPrice = await SellingPrice.findOne({
      where: {
        date: {
          [Op.lt]: startDate,
        },
      },
      order: [['id', 'DESC']],
    });

    if (singleSellingPrice) {
      sellingPricesData.push({
        date: singleSellingPrice.date,
        amount: Number(singleSellingPrice.amount),
      });
    }
  }

  // Get the last value before the query period if there are no selling/spot price data in this search
  if (spotPricesData.length === 0) {
    const singleSpotPrice = await SpotPrice.findOne({
      where: {
        date: {
          [Op.lt]: startDate,
        },
      },
      order: [['id', 'DESC']],
    });

    if (singleSpotPrice) {
      sellingPricesData.push({
        date: singleSpotPrice.date,
        amount: Number(singleSpotPrice.amount),
      });
    }
  }

  // Parse into expected output format
  const spotPrices: Price[] = spotPricesData.map((spotPrice: any) => ({
    date: spotPrice.dataValues.truncatedDate.toISOString(),
    amount: Number(spotPrice.amount),
  }));

  const sellingPrices: Price[] = sellingPricesData.map((sellingPrice: any) => ({
    date: sellingPrice.dataValues.truncatedDate.toISOString(),
    amount: Number(sellingPrice.amount),
  }));

  // Obtain unique dates of combined spot and selling prices by storing in a set
  let combinedDatesSet = new Set<String>();
  sellingPrices.forEach((sp) => {
    combinedDatesSet.add(sp.date);
  });
  spotPrices.forEach((sp) => {
    combinedDatesSet.add(sp.date);
  });

  const combinedDatesArray = Array.from(combinedDatesSet).sort((a, b) => {
    const dateA = new Date(a as string);
    const dateB = new Date(b as string);
    return dateA.getTime() - dateB.getTime();
  });
  /* Calculate Profit */
  // Convert selling prices into a map so that its key can be used for easier access
  const sellingPricesMap: Map<string, Price> = sellingPrices.reduce(
    (map: Map<string, Price>, sellingPrice: Price) => {
      const date = sellingPrice.date;
      map.set(date, {
        date,
        amount: Number(sellingPrice.amount),
      });

      return map;
    },
    new Map<string, Price>()
  );

  // Convert spot prices into a map so that its key can be used for easier access
  const spotPricesMap: Map<string, Price> = spotPrices.reduce(
    (map: Map<string, Price>, spotPrice: Price) => {
      const date = spotPrice.date;
      map.set(date, {
        date,
        amount: Number(spotPrice.amount),
      });

      return map;
    },
    new Map<string, Price>()
  );

  let profits: Price[] = [];
  let lastSellingPrice: number = Number(sellingPricesData[0]?.amount); // Store last available selling price for following calculations where selling price is missing but spot price exists for a particular date
  let lastSpotPrice: number = Number(spotPricesData[0]?.amount); // Opposite of above
  // Iterate through the granular dates in the period and get the profit by getting the difference between the selling price and spot price
  for (const date of combinedDatesArray) {
    const sellingPriceEntry = sellingPricesMap.get(date as string);
    const spotPriceEntry = spotPricesMap.get(date as string);

    // If spot price or selling price is missing, take the last available value
    const sellingPrice: number = sellingPriceEntry?.amount ?? lastSellingPrice;
    const spotPrice: number = spotPriceEntry?.amount ?? lastSpotPrice;

    profits.push({
      date: date as string,
      amount: Number(sellingPrice) - Number(spotPrice),
    });

    // Store current prices as last selling/spot prices to be used on subsequent calculations for missing values
    lastSellingPrice = sellingPrice;
    lastSpotPrice = spotPrice;
  }

  return {
    sellingPrices,
    spotPrices,
    profits,
  };
};

router.get('/warnings', async (req, res) => {
  // Retrieve warnings for a suburb
  const { suburb_id, consumer_id } = req.query;
  const {
    sequelize,
    Consumer,
    ConsumerConsumption,
    GoalType,
    SellingPrice,
    SpotPrice,
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
            goal: warningType.goalType,
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
      case 'high_spot_price':
        {
          // Suggestion for consumers to sell solar energy to grid
          const spotPrice = await SpotPrice.findOne({
            order: [['date', 'DESC']],
          });

          if (spotPrice === null) {
            break;
          }

          if (spotPrice.amount >= warningType.target) {
            warnings.push({
              category: warningType.category,
              description: warningType.description,
              data: { spot_price: spotPrice.amount },
              suggestion: `Energy spot price is at $${spotPrice.amount}/kWh, so sell excess solar energy to the grid to make money.`,
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

router.get('/suburbs/:id', async (req, res) => {
  const { sequelize, Suburb, Consumer } = req.app.get('models') as DbModelType;
  const id = req.params.id;
  try {
    const suburb = await Suburb.findOne({ where: { id: id } });
    if (!suburb) {
      return res.status(404).send('Suburb not found');
    }
    const consumerCounts = (await Consumer.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('consumer.id')), 'count'],
        'consumer.high_priority',
      ],
      include: [
        {
          model: Suburb,
          attributes: [],
          where: { id: id },
        },
      ],
      group: ['consumer.high_priority'],
      raw: true,
    })) as unknown as { count: string; high_priority: boolean }[];
    const highPriorityCount = parseInt(
      consumerCounts.find((c) => c.high_priority)?.count || '0'
    );
    const lowPriorityCount = parseInt(
      consumerCounts.find((c) => !c.high_priority)?.count || '0'
    );
    res.send({
      id: suburb.id,
      name: suburb.name,
      postcode: suburb.postcode,
      state: suburb.state,
      highPriorityConsumers: highPriorityCount,
      lowPriorityConsumers: lowPriorityCount,
    });
  } catch (error) {
    res.status(500).send({
      error: 'An error occurred while fetching suburbs',
    });
  }
});

/**
 * GET /retailer/reports
 *
 * Get list of IDs of reports already generated
 *
 * Response format:
 *  {
 *   "reports": [
 *       {
 *           "id": 1,
 *           "startDate": "2024-04-17T09:06:41Z",
 *           "endDate": "2024-04-17T09:06:41Z",
 *           "for": {
 *               "suburb_id": 2,
 *               "consumer_id": null,
 *           }
 *       }
 *   ]
 * }
 */
router.get('/reports', async (req, res) => {
  const { Report } = req.app.get('models');

  // Get all rows in reports table
  const reports = await Report.findAll();

  if (!reports) {
    return res.status(200).send({
      reports: [],
    })
  }

  const reportsFormatted = reports.map((report: any) => {
    return {
      id: Number(report.id),
      start_date: report.start_date,
      end_date: report.end_date,
      for: {
        suburb_id: Number(report.suburb_id),
        consumer_id: report.consumer_id,
      },
    };
  });

  // Return the reports
  return res.status(200).send({
    reports: reportsFormatted,
  });
});

/*
 * POST /retailer/reports
 * Generate a new report
 *
 * Body parameters:
 * - start_date: The start date of the period to generate the report for, in ISO format
 * - end_date: The end date of the period to generate the report for, in ISO format
 * - for: object with the following keys (one of which must be a non-null value and the other of which should be null):
 *   - suburb_id: The ID of the suburb to generate the report for
 *   - consumer_id: The ID of the consumer to generate the report for
 *
 * Response format:
 * {
 *    "id": 2
 * }
 */
router.post('/reports', async (req, res) => {
  const { sequelize, Report } = req.app.get('models');
  // Generate a new report
  const { start_date, end_date, for: forObj } = req.body;

  // Check if the for object is provided
  if (!forObj) {
    return res.status(400).send('for object must be provided');
  }

  // Check if either suburb_id or consumer_id is provided
  if (!forObj.suburb_id && !forObj.consumer_id) {
    return res
      .status(400)
      .send('Either suburb_id or consumer_id must be provided');
  }

  // Check if both suburb_id and consumer_id are provided
  if (forObj.suburb_id && forObj.consumer_id) {
    return res
      .status(400)
      .send('Cannot specify both suburb_id and consumer_id');
  }

  // Check if start_date and end_date are provided
  if (!start_date || !end_date) {
    return res.status(400).send('start_date and end_date must be provided');
  }

  // Check if start_date and end_date are valid dates
  if (
    isNaN(new Date(String(start_date)).getTime()) ||
    isNaN(new Date(String(end_date)).getTime())
  ) {
    return res
      .status(400)
      .send('Invalid date format. Provide dates in ISO string format.');
  }

  // Check if a report already exists for the given parameters
  const existingReport = await Report.findOne({
    where: {
      start_date: new Date(String(start_date)),
      end_date: new Date(String(end_date)),
      suburb_id: forObj.suburb_id || null,
      consumer_id: forObj.consumer_id || null,
    },
  });
  if (existingReport) {
    return res
      .status(400)
      .send('Report already exists for the given parameters');
  }

  // Get the latest report ID
  const latestReport = await Report.findOne({
    order: [['id', 'DESC']],
  });

  // Now that inputs are validated, create a new row in the reports table
  const newReport = await Report.create({
    id: latestReport ? Number(latestReport.id) + 1 : 1,
    start_date: new Date(String(start_date)),
    end_date: new Date(String(end_date)),
    suburb_id: forObj.suburb_id || null,
    consumer_id: forObj.consumer_id || null,
  });

  return res.status(200).send({
    id: Number(newReport.id),
  });
});

/*
 * GET /retailer/reports/[id]
 * Get the data for a specific report, given the id
 *
 * Response format:
 * {
 *  "id": 1,
 *  "start_date": "2024-03-17T09:06:41Z",
 *  "end_date": "2024-04-17T09:06:41Z",
 *  "for": {
 *    "suburb_id": 1,
 *    "consumer_id": null
 *  },
 *  "energy": [
 *    {
 *      "start_date": "2024-04-16T09:06:41Z",
 *      "end_date": "2024-04-17T09:06:41Z",
 *      "consumption": 123.45,
 *      "generation": 150.12
 *    }
 *  ],
 *  "profit": [
 *    {
 *      "date": "2024-04-16T09:06:41Z",
 *      "spot_price": 10,
 *      "selling_price": 10
 *    }
 *  ],
 *  "sources": [
 *    {
 *      "category": "Fossil Fuels",
 *      "renewable": false,
 *      "percentage": 0.1033,
 *      "amount": 148
 *    },
 *    {
 *      "category": "Renewable",
 *      "renewable": true,
 *      "percentage": 0.0419,
 *      "amount": 67
 *    }
 *  ]
 * }
 */
router.get('/reports/:id', async (req, res) => {
  const {
    Report,
    SellingPrice,
    SpotPrice,
    EnergyGenerator,
    EnergyGeneration,
    GeneratorType,
    SuburbConsumption,
  } = req.app.get('models');
  const db = req.app.get('models');
  const id = req.params.id;

  // Get the relevant row from the reports table
  const report = await Report.findByPk(id);
  let timeGranularity = 24; //granularity of the events in hours

  function intervalSorter(a: any, b: any) {
    return new Date(a.start_date).valueOf() - new Date(b.start_date).valueOf();
  }
  if (!report) {
    return res.status(404).send('Report not found');
  }

  let reportSuburbId: number = report.suburb_id;
  if (!report.suburb_id) {
    // Finds suburb_id of a consumer if not provided
    const consumer = await getConsumer(
      req.app.get('models'),
      report.consumer_id
    );

    reportSuburbId = Number(consumer?.dataValues.suburb_id);
  }

  let eventWhereClause = {
    date: {
      [Op.and]: {
        [Op.gt]: new Date(String(report.start_date)),
        [Op.lte]: new Date(String(report.end_date)),
      },
    },
  };

  let energy_generators = await EnergyGenerator.findAll({
    where: {
      suburb_id: {
        [Op.eq]: report.suburb_id,
      },
    },
  });
  const generator_ids = energy_generators.map(
    (generator: { id: number }) => generator.id
  );

  //get all the energy generation events.
  let energy_generations = await EnergyGeneration.findAll({
    where: { ...eventWhereClause, energy_generator_id: generator_ids },
  });

  //convert types
  energy_generations = energy_generations.map(
    (event: { date: Date; amount: number; energy_generator_id: number }) => ({
      date: moment.utc(event.date),
      amount: Number(event.amount),
      energy_generator_id: Number(event.energy_generator_id),
    })
  );

  let energySplits = splitEvents(
    energy_generations,
    String(report.start_date),
    String(report.end_date),
    timeGranularity
  ).sort(intervalSorter);

  //get all the energy consumption events.
  let suburb_consumptions = await SuburbConsumption.findAll({
    where: { ...eventWhereClause, suburb_id: report.suburb_id },
  });

  //convert types
  suburb_consumptions = suburb_consumptions
    .map(
      (event: { date: Date; amount: number; energy_generator_id: number }) => ({
        date: moment.utc(event.date),
        amount: Number(event.amount),
      })
    )
    .sort(intervalSorter);

  let consumptionSplits = splitEvents(
    suburb_consumptions,
    String(report.start_date),
    String(report.end_date),
    timeGranularity
  );

  let energy: {}[];
  if (energySplits.length == 0 && consumptionSplits.length == 0) {
    // We have no data so we will just return blank
    energy = [];
  } else if (energySplits.length == 0) {
    // we only have consumption data
    energy = consumptionSplits.map(({ start_date, end_date, total }) => ({
      start_date,
      end_date,
      consumption: total,
      generation: null,
    }));
  } else if (consumptionSplits.length == 0) {
    // we only have generation data
    energy = energySplits.map(({ start_date, end_date, total }) => ({
      start_date,
      end_date,
      consumption: null,
      generation: total,
    }));
  } else {
    // we have both energy and consumption data.
    energy = energySplits.map(({ start_date, end_date, total }, index) => ({
      start_date,
      end_date,
      generation: total,
      consumption: consumptionSplits[index].total,
    }));
  }

  const energySources = await getEnergySourceBreakdown(
    db,
    report.start_date,
    report.end_date,
    reportSuburbId
  );

  const profitMarginData = await getProfitMargin(
    db,
    report.start_date,
    report.end_date
  );

  const finalReport = {
    id,
    start_date: report.start_date,
    end_date: report.end_date,
    for: {
      suburb_id: report.suburb_id,
      consumer_id: report.consumer_id,
    },
    energy: energy,
    selling_prices: profitMarginData.sellingPrices,
    spot_prices: profitMarginData.spotPrices,
    profits: profitMarginData.profits,
    sources: energySources,
  };

  console.log(finalReport);
  // Return the data for the report
  res.status(200).send(finalReport);
});

function eventSorter(a: any, b: any) {
  return new Date(a.date).valueOf() - new Date(b.date).valueOf();
}

/**
 * Converts an energy event in kW into kWh
 * Amount is given in Kw
 * Result should be given in kwh
 * @param events
 */
function rollupEvents(events: [{ date: Moment; amount: number }]) {
  events.sort(eventSorter);

  let priorDate: Moment;
  let durationEvents = events.map(
    (event): { date: Moment; amount: number; kwh: number } => {
      //Get the duration, or just use 0 if there isnt a prior date yet
      let duration =
        priorDate !== undefined ? event.date.diff(priorDate, 'hours', true) : 0;
      priorDate = event.date;
      return { ...event, kwh: event.amount * duration };
    }
  );

  return durationEvents.reduce(
    (acc: number, currVal: { kwh: number }) => acc + currVal.kwh,
    0
  );
}
/**
 * Takes in events with a date and an amount, and splits the events into intervals (from event to event)
 * @param events Expects to be sorted from oldest to newest
 * @param startDate the first date of the range
 * @param endDate the last date of the range
 */
function splitEvents(
  eventsRaw: { amount: number; date: string }[],
  startDateStr: string,
  endDateStr: string,
  interval: number
) {
  if (eventsRaw.length === 0) {
    return [];
  }
  let results = [];

  //convert to moments
  let events: { amount: number; date: Moment }[] = Array(...eventsRaw).map(
    ({ amount, date }) => ({
      amount,
      date: moment.utc(date),
    })
  );
  let startDate = moment.utc(startDateStr);
  let endDate = moment.utc(endDateStr);

  events.reverse(); // flip so newest event first, and oldest event last. this means we can use it as a stack
  //get current rate
  let intervalStart = startDate.clone(); //the date we are starting at
  let intervalEnd = startDate.clone().add(interval, 'hours');

  let pastEvent = events.pop()!;

  let nextEvent: { amount: number; date: Moment };
  let changePoint: Moment;
  if (events.length === 0) {
    nextEvent = pastEvent;
    changePoint = endDate.clone().add(1, 'd');
  } else {
    nextEvent = events.pop()!;

    changePoint = pastEvent.date
      .clone()
      .add(nextEvent.date.diff(pastEvent.date, 'ms') / 2, 'ms');
  }

  //handle interval overlapping end date
  while (intervalEnd <= endDate && events.length > 0) {
    //while we still have events left and we have at least one interval left

    if (changePoint > intervalEnd) {
      //Change point is outside this interval so we can just finish
      // The amount wont change so we can just generate a new entry
      results.push({
        start_date: intervalStart.toISOString(),
        end_date: intervalEnd.toISOString(),
        total: interval * pastEvent.amount,
      });

      // move to the next interval
      intervalStart = intervalEnd;
      intervalEnd = intervalStart.clone().add(interval, 'hours');
      continue;
    }

    if (changePoint == intervalEnd) {
      results.push({
        start_date: intervalStart.toISOString(),
        end_date: intervalEnd.toISOString(),
        total: interval * pastEvent.amount,
      });

      // move to the next interval
      intervalStart = intervalEnd;
      intervalEnd = intervalStart.clone().add(interval, 'hours');

      // set the next change point
      if (events.length == 0) {
        // if we have no more events, then we should finish this interval,
        // then we update the event and make the next change point after the end date
        pastEvent = nextEvent;
        changePoint = endDate.clone().add(1, 'h');
        break;
      } else {
        pastEvent = nextEvent;
        nextEvent = events.pop()!;
        changePoint = pastEvent.date
          .clone()
          .add(nextEvent.date.diff(pastEvent.date, 'ms') / 2, 'ms');
        continue;
      }
    }

    //change point is within this interval

    let intervalTotal = 0;
    let pointer: Moment = intervalStart;
    while (changePoint <= intervalEnd) {
      // go from pointer to change
      intervalTotal +=
        changePoint.diff(pointer, 'hours', true) * pastEvent.amount;
      // update pointer to old change
      pointer = changePoint;

      // calc a new change
      if (events.length == 0) {
        // We have no more events, but we know we arent in the final interval
        // so we just make the change point to be after the end date to simulate the rate not changing
        pastEvent = nextEvent;
        changePoint = endDate.clone().add(1, 'h');
        break;
      } else {
        pastEvent = nextEvent;
        nextEvent = events.pop()!;
        changePoint = pastEvent.date
          .clone()
          .add(nextEvent.date.diff(pastEvent.date, 'ms') / 2, 'ms');
      }
    }

    // now we just need to finish this interval
    // go from pointer to interval end
    intervalTotal +=
      intervalEnd.diff(pointer, 'hours', true) * pastEvent.amount;

    // and then we create the event
    results.push({
      start_date: intervalStart.toISOString(),
      end_date: intervalEnd.toISOString(),
      total: intervalTotal,
    });

    // move to the next interval
    intervalStart = intervalEnd;
    intervalEnd = intervalStart.clone().add(interval, 'hours');
  }
  //we have either run out of events, or the final interval has reached past the end date

  //if we have no more events, just make intervals until we are on the last interval
  if (events.length == 0) {
    while (intervalEnd < endDate) {
      // and then we create the event
      results.push({
        start_date: intervalStart.toISOString(),
        end_date: intervalEnd.toISOString(),
        total: interval * pastEvent.amount,
      });

      // move to the next interval
      intervalStart = intervalEnd;
      intervalEnd = intervalStart.clone().add(interval, 'hours');
    }
  }

  //we have handled any remaining intervals

  //if we have run out of intervals and it lined up right, we can just exit here
  if (intervalEnd.isSameOrAfter(endDate)) {
    //TODO better handling of equality
    return results;
  }

  // we have a partial interval remaining so add it and return
  results.push({
    start_date: intervalStart.toISOString(),
    end_date: intervalEnd.toISOString(),
    total: endDate.diff(intervalStart, 'h', true) * pastEvent.amount,
  });
  return results;
}
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
    id: number,
    street_address: string,
    suburb_id: number,
    latitude: number,
    longitude: number,
    high_priority: boolean,
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
    const clusterFeatures = turf.clustersDbscan(pointCollection, PROXIMITY, {
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

/**
 * GET /retailer/sources
 *
 * Retrieve a source breakdown of energy generation of a suburb/nationwide over a period of time.
 * When a consumer_id is provided, energy source breakdown of the suburb where the consumer lives in is displayed instead.
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
 *   sources: [
 *     {
 *        name: string,        // name of the energy source type
 *        amount: number,      // amount of energy in kWh
 *        percentage: number,  // percentage share of the source
 *        renewable: boolean   // is it a renewable source of energy?
 *     },
 *   ]
 * }
 *
 * Example response:
 * {
 *   suburb_id: 1,
 *   start_date: '2024-01-01T05:00:00Z',
 *   end_date: '2024-01-01T10:00:00Z',
 *   sources: [
 *     {
 *         name: 'Natural Gas Pipeline',
 *         amount: 300,
 *         percentage: 0.5,
 *         renewable: false
 *     },
 *     {
 *         name: 'Solar',
 *         amount: 300,
 *         percentage: 0.5,
 *         renewable: true
 *     },
 *   ]
 * }
 */
router.get('/sources', async (req, res) => {
  let { suburb_id, consumer_id, start_date, end_date } = req.query;

  const db = req.app.get('models') as DbModelType;

  try {
    // If no date range is provided, return error 400
    if (!start_date) {
      return res.status(400).send({
        error: 'Start date must be provided.',
      });
    }

    // Validate format of start_date
    const parsedStartDate = parse(
      String(start_date),
      "yyyy-MM-dd'T'HH:mm:ss.SSSX",
      new Date()
    );
    if (!isValid(parsedStartDate)) {
      return res.status(400).send({
        error: 'Invalid start date format. Provide dates in ISO string format.',
      });
    }

    let parsedEndDate;
    if (end_date) {
      // Validate format of end_date
      parsedEndDate = parse(
        String(end_date),
        "yyyy-MM-dd'T'HH:mm:ss.SSSX",
        new Date()
      );

      if (!isValid(parsedEndDate)) {
        return res.status(400).send({
          error: 'Invalid end date format. Provide dates in ISO string format.',
        });
      }
    } else {
      // Set end_date to now if not provided
      parsedEndDate = new Date();
    }

    // Validate that end_date is after start_date
    if (isBefore(parsedEndDate, parsedStartDate)) {
      return res
        .status(400)
        .send({ error: 'Start date must be before end date.' });
    }

    if (isBefore(new Date(), parsedEndDate)) {
      return res
        .status(400)
        .send({ error: 'End date must not be in the future.' });
    }

    if (suburb_id && consumer_id) {
      return res.status(400).send({
        error: 'Cannot specify both suburb_id and consumer_id.',
      });
    }

    // Retrieve suburb_id of consumer if only consumer_id is provided
    if (!suburb_id && consumer_id) {
      let consumer = await getConsumer(db, Number(consumer_id));

      suburb_id = String(consumer?.suburb_id);
    }

    const energySources = await getEnergySourceBreakdown(
      db,
      parsedStartDate,
      parsedEndDate,
      Number(suburb_id)
    );

    // Prepare return object
    let returnData: any = {
      start_date: parsedStartDate.toISOString(),
      end_date: parsedEndDate.toISOString(),
      sources: energySources,
    };

    // Add consumer_id if provided
    if (consumer_id) {
      returnData.consumer_id = Number(consumer_id);
    } else if (suburb_id) {
      returnData.suburb_id = Number(suburb_id);
    }

    return res.status(200).send(returnData);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Retrieves breakdown of energy generation by its generatory types.
 * @param db sequelize models
 * @param startDate start of date range
 * @param endDate end of date range
 * @param suburbId id of suburb
 * @returns array of energy source types and its amount and share of total generation
 */
const getEnergySourceBreakdown = async (
  db: DbModelType,
  startDate: Date,
  endDate: Date,
  suburbId?: number | string
) => {
  const { EnergyGeneration, EnergyGenerator, GeneratorType } = db;

  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  // Define where clause for suburb (if provided)
  let suburbWhere: any = {};
  if (suburbId) {
    suburbWhere.suburb_id = suburbId;
  }

  const result = (await EnergyGeneration.findAll({
    attributes: [
      [col('energy_generator.id'), 'generator_id'],
      [col('energy_generator.generator_type.category'), 'category'],
      [col('energy_generator.generator_type.renewable'), 'renewable'],
      [fn('AVG', col('energy_generation.amount')), 'amount'],
    ],
    where: {
      date: dateWhere,
    },
    include: [
      {
        model: EnergyGenerator,
        attributes: [],
        where: {
          ...suburbWhere,
        },
        include: [
          {
            model: GeneratorType,
            attributes: [],
          },
        ],
      },
    ],
    group: [
      'energy_generator.id',
      'energy_generator.generator_type.category',
      'energy_generator.generator_type.renewable',
    ],
    order: [['category', 'ASC']],
    raw: true,
    nest: true,
  })) as unknown as {
    generator_id: number;
    category: string;
    amount: number;
    renewable: boolean;
  }[];

  // Aggregate all sources into their generatory types
  const processedSourcesMap = result.reduce((sources: any, source) => {
    if (!sources[source.category]) {
      sources[source.category] = {
        category: source.category,
        renewable: source.renewable,
        amount: 0,
      };
    }

    sources[source.category].amount += Number(source.amount);

    return sources;
  }, {});

  // Convert processedSources from a Map into an Array
  const processedSources = Object.keys(processedSourcesMap).map((category) => {
    return processedSourcesMap[category];
  });

  // Calculate total generation
  const totalAmount = processedSources.reduce(
    (total: number, source: { amount: number }) => {
      total += Number(source.amount);

      return total;
    },
    0
  );

  // Get the number of hours in the period to convert kW to kWh
  const hoursInPeriod = differenceInHours(endDate, startDate);

  return processedSources.map((source: { amount: number }) => ({
    ...source,
    percentage: Number(source.amount) / totalAmount, // Get the percentage share of this source
    amount: Number(source.amount) * hoursInPeriod, // Convert kW to kWh,
  }));
};

/**
 * GET /retailer/renewable-generation
 *
 * Retrieve average renewable energy generation data for a suburb over a period of time in kWh.
 * Based on the time period, the data is aggregated by hour, day, or week.
 * 
 * This API specifically filters the energy generation sources that are marked as "renewable."
 *
 * Query parameters:
 * - suburb_id: The ID of the suburb to retrieve data for. (optional)
 * - start_date: The start date of the period to retrieve data for, in ISO format. (required)
 * - end_date: The end date of the period to retrieve data for, in ISO format. (optional, defaults to now)
 *
 * Response format:
 * {
 *   suburb_id: number, // The ID of the suburb (if provided)
 *   start_date: string, // The start date input
 *   end_date: string, // The end date input (now if not provided)
 *   renewable_energy: [
 *     { date: string, amount: number }, // An array of { date: string, amount: number } objects, where the date is based on granularity and the amount represents renewable energy generated.
 *   ]
 * }
 *
 * Example response:
 * {
 *   suburb_id: 1,
 *   start_date: '2024-01-01T05:00:00Z',
 *   end_date: '2024-01-01T10:00:00Z',
 *   renewable_energy: [
 *     {
 *         date: '2024-01-01T08:00:00Z',
 *         amount: 800, // Renewable energy generation in kWh
 *     },
 *     ...
 *   ]
 * }
 */

router.get('/renewable-generation', async (req, res) => {
  try {
    let { suburb_id, start_date, end_date } = req.query; // Get query parameters
    let { sequelize, EnergyGeneration, EnergyGenerator, GeneratorType } =
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

    // If no start date is provided, return error 400
    if (!start_date)
      return res.status(400).send('Start date must be provided.');

    // If no end date is provided, set it to the current date
    if (!end_date) {
      end_date = moment().toISOString();
    }

    // Validate date formats
    if (!moment(String(start_date), moment.ISO_8601, true).isValid()) {
      return res.status(400).send('Invalid start date format. Use ISO format.');
    }

    if (!moment(String(end_date), moment.ISO_8601, true).isValid()) {
      return res.status(400).send('Invalid end date format. Use ISO format.');
    }

    if (start_date > end_date) {
      return res.status(400).send('Invalid date range.');
    }

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

    // Retrieve renewable energy generation data based on the date granularity
    const result = await EnergyGeneration.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('amount')), 'amount'], // Average the amount of renewable energy generated
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
          include: [
            {
              model: GeneratorType,
              attributes: [],
              where: {
                renewable: true, // Filter for renewable energy generators
              },
            },
          ],
        },
      ],
      where: {
        ...dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });

    // Prepare the data to be returned
    let returnData: any = {
      start_date: start_date,
      end_date: end_date,
      renewable_energy: [],
    };

    // Add suburb_id to the return data (if provided)
    if (suburb_id) {
      returnData.suburb_id = Number(suburb_id);
    }

    // Extract the renewable energy generation data
    result.forEach((generation: any) => {
      const date = moment(generation.dataValues.truncatedDate).toISOString();

      // Add the date and amount of renewable energy generated to the return data
      returnData.renewable_energy.push({
        date,
        amount:
          Number(generation.dataValues.amount) *
          kWhConversionMultiplier(dateGranularity.name), // Converts from kW to kWh based on granularity
      });
    });

    return res.status(200).send(returnData);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal server error');
  }
});


/**
 * Retrieves consumer data.
 * @param db sequalize models
 * @param id id of consumer
 * @returns consumer data
 */
const getConsumer = async (db: DbModelType, id: number | string) => {
  const { Consumer } = db;

  return await Consumer.findByPk(id);
};

export default router;

// Only export these functions if the node enviornment is set to testing
export let exportsForTesting: {
  splitEvents: (
    events: { amount: number; date: string }[],
    startDate: string,
    endDate: string,
    interval: number
  ) => { start_date: string; end_date: string; total: number }[];
};
if (process.env.NODE_ENV === 'test') {
  exportsForTesting = { splitEvents };
}
