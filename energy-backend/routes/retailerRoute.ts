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
  differenceInHours,
  isBefore,
  isValid,
  parseISO,
} from 'date-fns';

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

  const { data: dates, error: dateError } = validateDateInputs(String(start_date), String(end_date));

  if (dateError) {
    return res.status(dateError.status).json({
      error: dateError.message
    })
  }

  const consumption = await getEnergyConsumption(models, dates.startDate, dates.endDate, Number(suburb_id), Number(consumer_id));

  return res.status(200).send({
    start_date,
    end_date,
    ...(suburb_id && { suburb_id: Number(suburb_id) }),
    ...(consumer_id && { consumer_id: Number(consumer_id) }),
    energy: consumption,
  });
});


/**
 * Retrieves average energy consumption data of a suburb (optional) or suburb of a consumer (optional) or nationwide from the database.
 * 
 * Cannot provide suburbId and consumerId together.
 * 
 * @param models sequelize models
 * @param startDate start of date period
 * @param endDate end of date period
 * @param suburbId ID of suburb (optional)
 * @param consumerId ID of consumer (optional)
 * @returns array of temporaly granulated energy generation data in time period
 */
const getEnergyConsumption = async (
  models: DbModelType,
  startDate: Date,
  endDate: Date,
  suburbId?: number | string,
  consumerId?: number | string
): Promise<Energy[]> => {
  const { ConsumerConsumption, SuburbConsumption } = models;
  
  // Define where clause for date range
  let dateGranularity =
    getTemporalGranularity(startDate.toISOString(), endDate.toISOString());
    
  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  let result;

  if (suburbId) {
    result = await SuburbConsumption.findAll({
      attributes: [
        [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy generated
        [
          fn('date_trunc', dateGranularity.sequelize, col('date')),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      where: {
        suburb_id: suburbId,
        date: dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });
  } else if (consumerId) {
    result = await ConsumerConsumption.findAll({
      attributes: [
        [fn('AVG', col('amount')), 'amount'], // Averages the amount of energy consumed
        [
          fn('date_trunc', dateGranularity.sequelize, col('date')),
          'truncatedDate',
        ], // Truncate the date based on the date granularity
      ],
      group: ['truncatedDate'],
      where: {
        consumer_id: consumerId,
        date: dateWhere,
      },
      order: [['truncatedDate', 'ASC']],
    });
  } else {
    // Return nation-wide totals
    result = await SuburbConsumption.findAll({
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

  const multiplier = kWhConversionMultiplier(dateGranularity.name);

  const consumption = result.map((item: any) => ({
    date: new Date(item.dataValues.truncatedDate).toISOString(),
    amount: Number(item.dataValues.amount) * multiplier, // Converts the energy consumed into kWh based on the temporal granularity
  }));

  return consumption
}

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
  const { suburb_id, start_date, end_date } = req.query; // Get query parameters
  const models = req.app.get('models');

    // Check if suburb_id is an integer
  if (suburb_id && !isValidId(Number(suburb_id))) {
    return res.status(400).send('Suburb ID must be an integer');
  }

  // Validate date inputs
  const { data: dates, error: dateError } = validateDateInputs(String(start_date), String(end_date));

  if (dateError) {
    return res.status(dateError.status).json({
      error: dateError.message
    })
  }

  const generation = await getEnergyGeneration(models, dates.startDate, dates.endDate, Number(suburb_id));

  return res.status(200).send({
    start_date,
    end_date,
    ...(suburb_id && { suburb_id: Number(suburb_id) }),
    energy: generation,
  });
});

interface Energy {
  date: string;
  amount: number;
}

/**
 * Retrieves average energy generation data of a suburb (if provided) or nationwide from the database.
 * 
 * @param models sequelize models
 * @param startDate start of date period
 * @param endDate end of date period
 * @param suburbId ID of suburb (optional)
 * @returns array of temporaly granulated energy generation data in time period
 */
const getEnergyGeneration = async (
  models: DbModelType,
  startDate: Date,
  endDate: Date,
  suburbId?: number | string
): Promise<Energy[]> => {
  const { EnergyGeneration, EnergyGenerator } = models;

  // Define where clause for suburb (if provided)
  let suburbWhere: { suburb_id?: number } = {};
  if (suburbId) {
    suburbWhere.suburb_id = Number(suburbId);
  }

  // Define where clause for date range
  let dateGranularity =
    getTemporalGranularity(startDate.toISOString(), endDate.toISOString());
    
  // Set up date range for query
  const dateWhere = {
    [Op.and]: {
      [Op.gt]: startDate,
      [Op.lte]: endDate,
    },
  };

  // Retrieve energy generation data based on the date granularity
  const result = await EnergyGeneration.findAll({
    attributes: [
      [fn('AVG', col('amount')), 'amount'], // Average the amount of energy generated
      [
        fn('date_trunc', dateGranularity.sequelize, col('date')),
        'truncatedDate',
      ], // Truncate the date based on the date granularity
    ],
    where: {
      date: dateWhere
    },
    include: [
      {
        model: EnergyGenerator,
        attributes: [],
        where: suburbWhere,
      },
    ],
    group: ['truncatedDate'],
    order: [['truncatedDate', 'ASC']],
  });

  const multiplier = kWhConversionMultiplier(dateGranularity.name);

  const generation = result.map((item: any) => ({
    date: new Date(item.dataValues.truncatedDate).toISOString(),
    amount:
      Number(item.dataValues.amount) * multiplier, // Converts the energy consumed into kWh based on the temporal granularity
  }));

  return generation
}

const isValidId = (id: number | string) => {
  return Number.isInteger(Number(id))
}

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
      // Check if suburb_id is an integer
      if (suburb_id && !isValidId(Number(suburb_id))) {
        return res.status(400).send('Suburb ID must be an integer');
      }    

      suburbWhere.suburb_id = suburb_id;
    } else {
      suburbWhere.suburb_id = {
        [Op.ne]: null,
      };
    }

    // Validate date inputs
    const { data: dates, error: dateError } = validateDateInputs(String(start_date), String(end_date));
  
    if (dateError) {
      return res.status(dateError.status).send({
        error: dateError.message
      })
    }

    // Determine the date granularity based on the date range
    let dateGranularity: { name: string; sequelize: string } =
      getTemporalGranularity(dates.startDate.toISOString(), dates.endDate.toISOString());

    // Set the date range to be between the two dates
    const dateWhere = {
      [Op.and]: {
        [Op.gt]: dates.startDate,
        [Op.lte]: dates.endDate,
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
        date: dateWhere,
      },
      order: [
        ['truncatedDate', 'ASC'],
        ['energy_generator_id', 'ASC'],
      ],
    });

    // This section groups the energy generation data by energy generator
    // Cycles through each energy generation and appends it to the array of the corresponding energy generator
    const generators = result.reduce((generators: any, generator: any) => {
      const generatorId = generator.dataValues.energy_generator_id;
      const date = moment(generator.dataValues.truncatedDate).toISOString();
      const amount =
        Number(generator.dataValues.amount) *
        kWhConversionMultiplier(dateGranularity.name); // Convert energy generated into kWh based on the temporal granularity

      // If the generator ID is not in the return data, add it
      // Adds the generator ID and an empty array for the energy data
      if (!generators[generatorId]) {
        generators[generatorId] = {
          energy_generator_id: Number(generatorId),
          energy: [],
        };
      }

      // Add the energy generation data to the gemerator's array of energy data
      generators[generatorId].energy.push({
        date,
        amount,
      });

      return generators
    }, {});

    return res.status(200).send({
      start_date,
      end_date,
      ...( suburb_id && { suburb_id: Number(suburb_id) }),
      generators: Object.values(generators),  // Convert the generators object to an array
    });
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
  const models = req.app.get('models');

  // If no date range is provided, return error 400
  if (!start_date) {
    return res.status(400).send({
      error: 'Start date must be provided.',
    });
  }

  // Validate date inputs
  const { data: dates, error: dateError } = validateDateInputs(String(start_date), String(end_date));

  if (dateError) {
    return res.status(dateError.status).json({
      error: dateError.message
    })
  }

  const prices = await getProfitMargin(models, dates.startDate, dates.endDate);

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
 * Retrieve the average spot prices, selling prices, and profits (derived from selling price - spot price) during a given period of time.
 * Based on the time period, the data is aggregated by hour, day, or week. Profit is only calculated on dates that contain a selling price
 * or spot price. If a date is missing one of the price values, the previous value is used instead to calculate the profit of the particular
 * date.
 * @param models sequelize models
 * @param startDate start of date range
 * @param endDate end of date range
 * @returns arrays of selling price, spot price, and profit data
 */
const getProfitMargin = async (
  models: DbModelType,
  startDate: Date,
  endDate: Date
) => {
  const { SellingPrice, SpotPrice } = models;

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
    EnergyGenerator,
    EnergyGeneration,
    SuburbConsumption,
  } = req.app.get('models');
  const models = req.app.get('models');
  const id = req.params.id;

  // Get the relevant row from the reports table
  const report = await Report.findByPk(id);
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

  const energyGeneration = await getEnergyGeneration(models, report.start_date, report.end_date, reportSuburbId);

  const energyConsumption = await getEnergyConsumption(models, report.start_date, report.end_date, report.suburb_id, report.consumer_id);

  const { data: greenEnergy } = await getGreenEnergy(models, report.start_date, report.end_date, report.suburb_id);

  const energySources = await getEnergySourceBreakdown(
    models,
    report.start_date,
    report.end_date,
    reportSuburbId
  );

  const profitMarginData = await getProfitMargin(
    models,
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
    energy: {
      ...(report.suburb_id && { generation: energyGeneration }),
      consumption: energyConsumption,
      sources: energySources,
      green_energy: {
        green_goal_percent: greenEnergy.greenGoalPercent,
        green_usage_percent: greenEnergy.greenUsagePercent
      }
    },
    selling_prices: profitMarginData.sellingPrices,
    spot_prices: profitMarginData.spotPrices,
    profits: profitMarginData.profits,
  };

  // Return the data for the report
  res.status(200).send(finalReport);
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

  const models = req.app.get('models') as DbModelType;

  if (suburb_id && consumer_id) {
    return res.status(400).send({
      error: 'Cannot specify both suburb_id and consumer_id.',
    });
  }

  // Validate date inputs
  const { data: dates, error: dateError } = validateDateInputs(String(start_date), String(end_date));

  if (dateError) {
    return res.status(dateError.status).send({
      error: dateError.message
    })
  }

  // Retrieve suburb_id of consumer if only consumer_id is provided
  let consumerSuburbId = null;
  if (!suburb_id && consumer_id) {
    let consumer = await getConsumer(models, Number(consumer_id));

    consumerSuburbId = String(consumer?.suburb_id);
  }

  const energySources = await getEnergySourceBreakdown(
    models,
    dates.startDate,
    dates.endDate,
    consumerSuburbId ?? Number(suburb_id)
  );

  return res.status(200).send({
    start_date,
    end_date,
    ...(consumer_id && { consumer_id: Number(consumer_id) }),
    ...(suburb_id && { suburb_id: Number(suburb_id) }),
    sources: energySources,
  });
});

/**
 * Retrieves breakdown of energy generation by its generatory types.
 * @param models sequelize models
 * @param startDate start of date range
 * @param endDate end of date range
 * @param suburbId id of suburb
 * @returns array of energy source types and its amount and share of total generation
 */
const getEnergySourceBreakdown = async (
  models: DbModelType,
  startDate: Date,
  endDate: Date,
  suburbId?: number | string
) => {
  const { EnergyGeneration, EnergyGenerator, GeneratorType } = models;

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

  const result = await EnergyGeneration.findAll({
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
  }) as unknown as {
    generator_id: number;
    category: string;
    amount: number;
    renewable: boolean;
  }[];
  
  interface AggregatedSource {
    category: string;
    renewable: boolean;
    amount: number;
  }
  
  interface SourcesMap {
    [category: string]: AggregatedSource;
  }

  // Aggregate all sources into their generatory types
  const processedSourcesMap = result.reduce<SourcesMap>((sources, source) => {
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
 * GET /retailer/renewableGeneration
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

router.get('/renewableGeneration', async (req, res) => {
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

    // Validate date inputs
    const { data: dates, error: dateError } = validateDateInputs(String(start_date), String(end_date));

    if (dateError) {
      return res.status(dateError.status).json({
        error: dateError.message
      })
    }

    // Define where clause for date range
    let dateGranularity: { name: string; sequelize: string } =
      getTemporalGranularity(String(dates.startDate), String(dates.endDate));
    // Set up date range for query
    const dateWhere = {
      [Op.and]: {
        [Op.gt]: dates.startDate,
        [Op.lte]: dates.endDate,
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
        date: dateWhere,
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


router.get('/greenEnergy', async (req, res) => {
  const models = req.app.get('models') as DbModelType;

  const { data, error } = await getGreenEnergy(models);

  if (error) {
    return res.status(error.status).json({
      error: error.message
    })
  }
  
  return res.status(200).json({
    green_usage_percent: data.greenUsagePercent,
    green_goal_percent: data.greenGoalPercent,
  });
});

/**
 * Retrieves green energy usage and goal statistics from the database.
 * 
 * @param models sequelize models
 * @param startDate start of date period
 * @param endDate end of date period
 * @param suburbId ID of suburb
 * @returns percentage of energy generation is renewable, percentage progress towards green energy goal, and potential errors
 */
const getGreenEnergy = async (models: DbModelType, startDate?: Date, endDate?: Date, suburbId?: number | string) => {
  let dateWhere = {};
  if (startDate && endDate) {
    dateWhere = {
      [Op.and]: {
        [Op.gt]: startDate,
        [Op.lte]: endDate,
      },
    }
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateWhere = { [Op.gte]: yesterday };
  } 

  // Define where clause for suburb (if provided)
  let suburbWhere: { suburb_id?: number } = {};
  if (suburbId) {
    suburbWhere.suburb_id = Number(suburbId);
  }

  // Fetch energy generation grouped by renewable (T/F) in the past 24 hours
  const energyGeneration = (await models.EnergyGeneration.findAll({
    attributes: [
      [fn('SUM', col('energy_generation.amount')), 'total_amount'],
      'energy_generator.generator_type.renewable',
    ],
    include: [
      {
        model: models.EnergyGenerator,
        attributes: [],
        where: {
          ...suburbWhere
        },
        include: [
          {
            model: models.GeneratorType, // Joins generator type to get renewable information
            attributes: [],
          },
        ],
      },
    ],
    where: {
      date: dateWhere
    },
    group: ['energy_generator.generator_type.renewable'], // Groups the result by renewable status
    raw: true,
  })) as unknown as { total_amount: string; renewable: boolean }[];

  const renewableGeneration = energyGeneration.find(
    (item) => item.renewable
  )?.total_amount;
  const nonrenewableGeneration = energyGeneration.find(
    (item) => !item.renewable
  )?.total_amount;

  // Check if there is no generation information
  const noData = !renewableGeneration && !nonrenewableGeneration;
  if (noData)
    return {
      data: {
        greenUsagePercent: null,
        greenGoalPercent: null,
      },
      error: {
        status: 400,
        message: 'No generation records in the last 24 hours were found.'
      }
    }

  // Calculate green energy generation percentage
  let greenUsagePercent;
  if (!renewableGeneration) {
    greenUsagePercent = 0;
  } else if (!nonrenewableGeneration) {
    greenUsagePercent = 1;
  } else {
    greenUsagePercent =
      parseFloat(renewableGeneration) /
      (parseFloat(nonrenewableGeneration) + parseFloat(renewableGeneration));
  }

  // Calculate percentage of green energy goal completed
  const greenTarget = (
    await models.WarningType.findOne({ where: { category: 'fossil_fuels' } })
  )?.target;
  if (!greenTarget) {
    return {
      data: {
        greenUsagePercent: null,
        greenGoalPercent: null,
      },
      error: {
        status: 400,
        message: 'No green target found.'
      }
    }
  }
  const greenGoalPercent = greenUsagePercent / parseFloat(greenTarget);

  return {
    data: {
      greenUsagePercent,
      greenGoalPercent,
    }
  }
}

const validateDateInputs = (startDate: String, endDate?: String) => {
  // If no date range is provided, return error 400
  if (!startDate || startDate === 'undefined') {
    return {
      error: {
        status: 400,
        message: 'Start date must be provided.'
      }
    };
  }

  // Validate format of start_date
  if (!isValid(parseISO(String(startDate)))) {
    return {
      error: {
        status: 400,
        message: 'Invalid start date format. Provide dates in ISO string format.' 
      }
    };
  }
  const parsedStartDate = new Date(String(startDate));

  let parsedEndDate;
  if (endDate && endDate !== 'undefined') {
    // Validate format of end_date
    if (!isValid(parseISO(String(endDate)))) {
      return {
        error: {
          status: 400,
          message: 'Invalid end date format. Provide dates in ISO string format.'
        }
      };
    }
    parsedEndDate = new Date(String(endDate));
  } else {
    // Set end_date to now if not provided
    parsedEndDate = new Date();
  }

  // Validate that end_date is after start_date
  if (isBefore(parsedEndDate, parsedStartDate)) {
    return { 
      error: {
        status: 400,
        message: 'Start date must be before end date.' 
      }
    };
  }

  if (isBefore(new Date(), parsedEndDate)) {
    return { 
      error: {
        status: 400,
        message: 'End date must not be in the future.' 
      }
    };
  }

  return {
    data: {
      startDate: parsedStartDate,
      endDate: parsedEndDate
    }
  }
}

/**
 * Retrieves consumer data.
 * @param models sequalize models
 * @param id id of consumer
 * @returns consumer data
 */
const getConsumer = async (models: DbModelType, id: number | string) => {
  const { Consumer } = models;

  return await Consumer.findByPk(id);
};

export default router;
