import express from 'express';

import {
  getConsumer,
  getEnergyGeneration,
  getEnergyConsumption,
  getEnergySourceBreakdown,
  getGreenEnergy,
  getProfitMargin,
  getSpending,
} from '../utils/dbUtils';

const router = express.Router();

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
router.get('/', async (req, res) => {
  const { Report } = req.app.get('models');

  // Get all rows in reports table
  const reports = await Report.findAll();

  if (!reports) {
    return res.status(200).send({
      reports: [],
    });
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
router.post('/', async (req, res) => {
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
 *  ],
 *  "spending": [
 *     {
 *       "date": "2024-04-16T09:06:41Z",
 *       "amount": 10,
 *     }
 *   ]
 *  ]
 * }
 */
router.get('/:id', async (req, res) => {
  const { Report } = req.app.get('models');
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

  const energyGeneration = await getEnergyGeneration(
    models,
    report.start_date,
    report.end_date,
    reportSuburbId
  );

  const energyConsumption = await getEnergyConsumption(
    models,
    report.start_date,
    report.end_date,
    report.suburb_id,
    report.consumer_id
  );

  const { data: greenEnergy } = await getGreenEnergy(
    models,
    report.start_date,
    report.end_date,
    reportSuburbId
  );

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

  const consumerSpendingData = await getSpending(
    models,
    report.start_date,
    report.end_date,
    report.consumer_id
  );

  const finalReport = {
    id,
    start_date: report.start_date,
    end_date: report.end_date,
    for: {
      suburb_id: report.suburb_id ? Number(report.suburb_id) : null,
      consumer_id: report.consumer_id ? Number(report.consumer_id) : null,
    },
    energy: {
      ...(report.suburb_id && { generation: energyGeneration }),
      consumption: energyConsumption,
      sources: energySources,
      green_energy: {
        green_goal_percent: greenEnergy.greenGoalPercent,
        green_usage_percent: greenEnergy.greenUsagePercent,
      },
    },
    ...(report.suburb_id && {
      selling_prices: profitMarginData.sellingPrices,
      spot_prices: profitMarginData.spotPrices,
      profits: profitMarginData.profits,
    }),
    ...(report.consumer_id && { spending: consumerSpendingData }),
  };

  // Return the data for the report
  res.status(200).send(finalReport);
});

export default router;
