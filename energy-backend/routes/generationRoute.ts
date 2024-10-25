import express from 'express';
import { Op } from 'sequelize';

// Import the turf module for clustering
import { defineModels } from '../databaseModels';
import {
  kWhConversionMultiplier,
  getTemporalGranularity,
  validateDateInputs,
  isValidId,
} from '../utils/utils';

import {
  getConsumer,
  getEnergyGeneration,
  getEnergySourceBreakdown,
  getGreenEnergy,
} from '../utils/dbUtils';

const router = express.Router();

type DbModelType = ReturnType<typeof defineModels>;

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
    const { data: dates, error: dateError } = validateDateInputs(
      String(start_date),
      String(end_date)
    );

    if (dateError) {
      return res.status(dateError.status).send({
        error: dateError.message,
      });
    }

    // Determine the date granularity based on the date range
    let dateGranularity: { name: string; sequelize: string } =
      getTemporalGranularity(
        dates.startDate.toISOString(),
        dates.endDate.toISOString()
      );

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
      const date = new Date(generator.dataValues.truncatedDate).toISOString();
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

      return generators;
    }, {});

    return res.status(200).send({
      start_date,
      end_date,
      ...(suburb_id && { suburb_id: Number(suburb_id) }),
      generators: Object.values(generators), // Convert the generators object to an array
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
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
  const { suburb_id, start_date, end_date } = req.query; // Get query parameters
  const models = req.app.get('models');

  // Check if suburb_id is an integer
  if (suburb_id && !isValidId(Number(suburb_id))) {
    return res.status(400).send('Suburb ID must be an integer');
  }

  // Validate date inputs
  const { data: dates, error: dateError } = validateDateInputs(
    String(start_date),
    String(end_date)
  );

  if (dateError) {
    return res.status(dateError.status).json({
      error: dateError.message,
    });
  }

  const generation = await getEnergyGeneration(
    models,
    dates.startDate,
    dates.endDate,
    Number(suburb_id)
  );

  return res.status(200).send({
    start_date,
    end_date,
    ...(suburb_id && { suburb_id: Number(suburb_id) }),
    energy: generation,
  });
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
  const { data: dates, error: dateError } = validateDateInputs(
    String(start_date),
    String(end_date)
  );

  if (dateError) {
    return res.status(dateError.status).send({
      error: dateError.message,
    });
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
    const { data: dates, error: dateError } = validateDateInputs(
      String(start_date),
      String(end_date)
    );

    if (dateError) {
      return res.status(dateError.status).json({
        error: dateError.message,
      });
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
    const renewable_energy = result.reduce(
      (
        renewable_energy: { date: string; amount: number }[],
        generation: any
      ) => {
        const date = new Date(
          generation.dataValues.truncatedDate
        ).toISOString();

        // Add the date and amount of renewable energy generated to the return data
        renewable_energy.push({
          date,
          amount:
            Number(generation.dataValues.amount) *
            kWhConversionMultiplier(dateGranularity.name), // Converts from kW to kWh based on granularity
        });

        return renewable_energy;
      },
      []
    );

    return res.status(200).send({
      start_date,
      end_date,
      ...(suburb_id && { suburb_id: Number(suburb_id) }),
      renewable_energy,
    });
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
      error: error.message,
    });
  }

  return res.status(200).json({
    green_usage_percent: data.greenUsagePercent,
    green_goal_percent: data.greenGoalPercent,
  });
});

export default router;
