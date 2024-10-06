import express from 'express';
import { defineModels } from '../databaseModels';
import { col, fn, Op } from 'sequelize';

const router = express.Router();
type DbModelType = ReturnType<typeof defineModels>;

router.get('/buyingPrice', async (req, res) => {
  try {
    // Get retailer selling price model
    const { SellingPrice } = req.app.get('models');

    // Find the latest retailer selling price
    const result = await SellingPrice.findOne({
      order: [['date', 'DESC']],
    });

    // If no selling price is found, return 404
    if (!result) {
      return res.status(404).send({
        error: 'No buying price found',
      });
    }

    // Return the latest retailer selling price along with the date
    return res.status(200).send({
      date: result.date,
      amount: Number(result.amount),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      error: 'Something went wrong. Please try again later.',
    });
  }
});

router.get('/greenEnergy', async (req, res) => {
  const db = req.app.get('models') as DbModelType;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Fetch energy generation grouped by renewable (T/F) in the past 24 hours
  const energyGeneration = (await db.EnergyGeneration.findAll({
    attributes: [
      [fn('SUM', col('energy_generation.amount')), 'total_amount'],
      'energy_generator.generator_type.renewable',
    ],
    include: [
      {
        model: db.EnergyGenerator,
        attributes: [],
        include: [
          {
            model: db.GeneratorType, // Joins generator type to get renewable information
            attributes: [],
          },
        ],
      },
    ],
    where: {
      date: { [Op.gte]: yesterday },
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
    return res.status(400).json({ error: 'No generation records found.' });

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
    await db.WarningType.findOne({ where: { category: 'fossil_fuels' } })
  )?.target;
  if (!greenTarget) {
    return res.status(400).json({ error: 'No green target found.' });
  }
  const greenGoalPercent = greenUsagePercent / parseFloat(greenTarget);

  return res.json({
    greenUsagePercent,
    greenGoalPercent,
  });
});

export default router;
