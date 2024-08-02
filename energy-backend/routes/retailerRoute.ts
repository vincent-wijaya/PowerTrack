import express from 'express';
import moment from 'moment';
import { Op } from 'sequelize';

const router = express.Router();

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
  const { suburb_id, consumer_id, start_date, end_date } = req.query;
  const { sequelize, SuburbConsumption, ConsumerConsumption } =
    req.app.get('models');

  let date_where_clause;
  if (start_date !== undefined && end_date !== undefined) {
    date_where_clause = {
      [Op.between]: [new Date(String(start_date)), new Date(String(end_date))],
    };
  } else if (start_date !== undefined) {
    date_where_clause = {
      [Op.gte]: new Date(String(start_date)),
    };
  } else if (end_date !== undefined) {
    date_where_clause = {
      [Op.lte]: new Date(String(end_date)),
    };
  } else {
    date_where_clause = {
      [Op.ne]: null,
    };
  }

  let consumptions;

  if (suburb_id && consumer_id) {
    return res
      .status(400)
      .send('Cannot specify both suburb_id and consumer_id');
  } else if (suburb_id) {
    consumptions = await SuburbConsumption.findAll({
      where: {
        suburb_id: suburb_id,
        date: date_where_clause,
      },
    });
  } else if (consumer_id) {
    consumptions = await ConsumerConsumption.findAll({
      where: {
        consumer_id: consumer_id,
        date: date_where_clause,
      },
    });
  } else {
    // Return nation-wide totals
    consumptions = await SuburbConsumption.findAll({
      attributes: [
        'suburb_id',
        [sequelize.fn('SUM', sequelize.col('amount')), 'amount'],
      ],
      where: {
        date: {
          [Op.between]: [
            start_date
              ? new Date(String(start_date))
              : new Date('1970-01-01T00:00:00Z'),
            end_date
              ? new Date(String(end_date))
              : new Date('9999-01-01T00:00:00Z'),
          ],
        },
      },
      group: ['suburb_id'],
    });
    consumptions = consumptions.map((x: any) => {
      return {
        suburb_id: x.suburb_id,
        start_date: start_date,
        end_date: end_date,
        amount: x.amount,
      };
    });
  }
  res.send({
    energy: consumptions,
  });
});

/**
 * GET /retailer/generation
 *
 * Retrieve energy generation data for a suburb over a period of time.
 * Based on the time period, the data is aggregated by hour, day, or week.
 *
 * Query parameters:
 * - suburb_id: The ID of the suburb to retrieve data for.
 * - start_date: The start date of the period to retrieve data for, in ISO format
 * - end_date: The end date of the period to retrieve data for, in ISO format
 *
 * Response format:
 * {
 *  suburb_id: number, // The ID of the suburb (if provided)
 *  energy: [ [string, number], ... ] // An array of [date, amount] pairs, where the string is the ISO date and the number is the amount of energy generated.
 * }
 *
 * Example response:
 * {
 *  suburb_id: 1,
 *  energy: [
 *    ["2022-01-01T12:30Z", 100],
 *    ["2022-01-01T13:30Z", 120],
 *    ...
 *  ]
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
    let dateGranularity: any = null;
    let dateWhere: any = {};
    // Set the date range to be within the start and end dates
    dateWhere.date = {
      [Op.and]: {
        [Op.gt]: moment(String(start_date)).toISOString(),
        [Op.lte]: moment(String(end_date)).toISOString(),
      },
    };

    // Determine the date granularity based on the date range
    let dateDifference = moment(String(end_date)).diff(String(start_date));
    if (moment.duration(dateDifference).asMonths() >= 1) {
      dateGranularity = 'week';
    } else if (moment.duration(dateDifference).asWeeks() >= 1) {
      dateGranularity = 'day';
    } else {
      dateGranularity = 'hour';
    }

    // Retrieve energy generation data based on the date granularity
    const result = await EnergyGeneration.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'amount'], // Sum the amount of energy generated
        [
          sequelize.fn('date_trunc', dateGranularity, sequelize.col('date')),
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
      returnData.energy.push([date, Number(generation.dataValues.amount)]);
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
 *  {
 *    suburb_id: number, // The ID of the suburb (if provided)
 *    generators: [
 *      {
 *        energy_generator_id: number, // The ID of the energy generator
 *        energy: [
 *          [date: string, amount: number], // The date in ISO format and amount of energy generated
 *          ...
 *        ]
 *      },
 *      ...
 *    ]
 *  }
 *
 * Example response (hourly time granularity):
 *  {
 *    suburb_id: 1,
 *    generators: [
 *      {
 *        energy_generator_id: 1,
 *        energy: [
 *          ["2022-01-01T00:00:00Z", 100],
 *          ["2022-01-01T01:00:00Z", 120],
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

    // Define where clause for date range
    let dateGranularity: any = null;
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

    // Determine the date granularity based on the date range
    let dateDifference = moment(String(end_date)).diff(
      moment(String(start_date))
    );
    if (moment.duration(dateDifference).asMonths() >= 1) {
      dateGranularity = 'week';
    } else if (moment.duration(dateDifference).asWeeks() >= 1) {
      dateGranularity = 'day';
    } else {
      dateGranularity = 'hour';
    }

    // Retrieve energy generation data based on the date granularity
    const result = await EnergyGeneration.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('amount')), 'amount'], // Sum the amount of energy generated
        [
          sequelize.fn('date_trunc', dateGranularity, sequelize.col('date')),
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
      const amount = Number(generator.dataValues.amount);

      // If the generator ID is not in the return data, add it
      // Adds the generator ID and an empty array for the energy data
      if (!returnData.generators[generatorId]) {
        returnData.generators[generatorId] = {
          energy_generator_id: Number(generatorId),
          energy: [],
        };
      }

      // Add the energy generation data to the gemerator's array of energy data
      returnData.generators[generatorId].energy.push([date, amount]);
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
  const { Consumer, ConsumerConsumption, GoalType, SellingPrice, WarningType } =
    req.app.get('models');

  // Get goal types
  const goalTarget: string = consumer_id ? 'consumer' : 'retailer';
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

  // Iterate through each warning type
  let warnings: any[] = [];
  for (const warningType of warningTypes) {
    switch (warningType.category) {
      // Add a case for each warning type
      // Check for each type of warning whether the warning should be triggered
      // If triggered, add the warning data to the warnings array
      case 'outage_hp':
        // Get high priority consumers
        const whereClause: any = {
          where: {
            high_priority: true,
          },
        };
        if (suburb_id) {
          whereClause.where.suburb_id = suburb_id;
        }
        const consumers = await Consumer.findAll(whereClause);

        // Check if any of the high priority consumers have an outage
        // Check if their last consumption data is 0
        for (const consumer of consumers) {
          const consumption = await ConsumerConsumption.findOne({
            where: {
              consumer_id: consumer.id,
            },
            order: [['date', 'DESC']],
          });
          if (consumption && Number(consumption.amount) === 0) {
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
        }
        break;
      case 'high_cost':
        // Get the latest selling price
        const sellingPrice = await SellingPrice.findOne({
          order: [['date', 'DESC']],
        });

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
      default:
        console.log(`Unsupported warning category: ${warningType.category}`);
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
 *
 *
 * POST /retailer/reports
 * Generate a new report
 *
 * Query parameters:
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
 *
 */
router.get('/reports', async (req, res) => {
  const { sequelize, Report } = req.app.get('models');

  if (req.method === 'GET') {
    // Get the IDs of all reports
    // TODO
  } else if (req.method === 'POST') {
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

    // Now that inputs are validated, create a new report
    // TODO
  }
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
 *      "count": 148
 *    },
 *    {
 *      "category": "Renewable",
 *      "renewable": true,
 *      "percentage": 0.0419,
 *      "count": 67
 *    }
 *  ]
 * }
 *
 */
router.get('/retailer/reports/:id', (req, res) => {
  const id = req.params.id;

  // TODO
});

export default router;
