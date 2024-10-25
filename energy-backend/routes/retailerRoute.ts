import express from 'express';
import { Op } from 'sequelize';

// Import the turf module for clustering
import { defineModels } from '../databaseModels';
import { OUTAGE_HP_DURATION_THRESHOLD } from '../utils/constants';
import { validateDateInputs } from '../utils/utils';
import { subMinutes } from 'date-fns';

import { getProfitMargin } from '../utils/dbUtils';

const router = express.Router();

type DbModelType = ReturnType<typeof defineModels>;

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
  const { data: dates, error: dateError } = validateDateInputs(
    String(start_date),
    String(end_date)
  );

  if (dateError) {
    return res.status(dateError.status).json({
      error: dateError.message,
    });
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
                  [Op.gt]: subMinutes(
                    new Date(),
                    OUTAGE_HP_DURATION_THRESHOLD
                  ).toISOString(),
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

export default router;
