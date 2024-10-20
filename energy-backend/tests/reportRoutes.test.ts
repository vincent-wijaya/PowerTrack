// Set node enviornment to Test
process.env.NODE_ENV = 'test';

import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import { differenceInHours } from 'date-fns';

describe('GET /retailer/reports', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Create mock suburbs
    await appInstance.get('models').Suburb.bulkCreate([
      {
        id: 1,
        name: 'Test Suburb 1',
        postcode: 3000,
        state: 'Victoria',
        latitude: 100,
        longitude: 100,
      },
      {
        id: 2,
        name: 'Test Suburb 2',
        postcode: 3001,
        state: 'Victoria',
        latitude: 105,
        longitude: 100,
      },
    ]);

    // Create mock reports
    await appInstance.get('models').Report.bulkCreate([
      {
        id: 1,
        start_date: '2024-04-17T09:06:41Z',
        end_date: '2024-04-17T09:06:41Z',
        suburb_id: 2,
        consumer_id: null,
      },
      {
        id: 2,
        start_date: '2024-04-18T09:06:41Z',
        end_date: '2024-04-18T09:06:41Z',
        suburb_id: 1,
        consumer_id: null,
      },
    ]);
  });

  afterAll(async () => {
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return a list of existing reports', async () => {
    const response = await request(appInstance).get('/retailer/reports');

    expect(response.status).toBe(200);
    expect(response.body.reports.length).toBe(2);
    expect(response.body.reports).toEqual([
      expect.objectContaining({
        id: 1,
        start_date: '2024-04-17T09:06:41.000Z',
        end_date: '2024-04-17T09:06:41.000Z',
        for: {
          suburb_id: 2,
          consumer_id: null,
        },
      }),
      expect.objectContaining({
        id: 2,
        start_date: '2024-04-18T09:06:41.000Z',
        end_date: '2024-04-18T09:06:41.000Z',
        for: {
          suburb_id: 1,
          consumer_id: null,
        },
      }),
    ]);
  });
});

describe('POST /retailer/reports', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Create mock suburb
    await appInstance.get('models').Suburb.create({
      id: 1,
      name: 'Test Suburb 1',
      postcode: 3000,
      state: 'Victoria',
      latitude: 100,
      longitude: 100,
    });

    // Create mock consumer
    await appInstance.get('models').Consumer.create({
      id: 1,
      street_address: '10 Test Street Melbourne Victoria 3000',
      latitude: 100,
      longitude: 100,
      high_priority: false,
      suburb_id: 1,
    });
  });

  afterAll(async () => {
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should generate a new retailer report', async () => {
    const START_DATE = '2024-04-01T09:00:00Z';
    const END_DATE = '2024-04-30T09:00:00Z';
    const SUBURB_ID = 1;

    const response = await request(appInstance)
      .post('/retailer/reports')
      .send({
        start_date: START_DATE,
        end_date: END_DATE,
        for: {
          consumer_id: null,
          suburb_id: SUBURB_ID,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: expect.any(Number) });
  });

  it('should generate a new consumer report', async () => {
    const START_DATE = '2024-04-01T09:00:00Z';
    const END_DATE = '2024-04-30T09:00:00Z';
    const CONSUMER_ID = 1;

    const response = await request(appInstance)
      .post('/retailer/reports')
      .send({
        start_date: START_DATE,
        end_date: END_DATE,
        for: {
          consumer_id: CONSUMER_ID,
          suburb_id: null,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: expect.any(Number) });
  });

  it('should return error 400 if start date is missing', async () => {
    const END_DATE = '2024-04-30T09:00:00Z';
    const SUBURB_ID = 1;

    const response = await request(appInstance)
      .post('/retailer/reports')
      .send({
        end_date: END_DATE,
        for: {
          suburb_id: SUBURB_ID,
          consumer_id: null,
        },
      });

    expect(response.status).toBe(400);
  });

  it('should return error 400 if end date is missing', async () => {
    const START_DATE = '2024-04-01T09:00:00Z';
    const SUBURB_ID = 1;

    const response = await request(appInstance)
      .post('/retailer/reports')
      .send({
        start_date: START_DATE,
        for: {
          suburb_id: SUBURB_ID,
          consumer_id: null,
        },
      });

    expect(response.status).toBe(400);
  });

  it('should return error 400 if for object is missing', async () => {
    const START_DATE = '2024-04-01T09:00:00Z';
    const END_DATE = '2024-04-30T09:00:00Z';

    const response = await request(appInstance).post('/retailer/reports').send({
      start_date: START_DATE,
      end_date: END_DATE,
    });

    expect(response.status).toBe(400);
  });

  it('should return error 400 if both suburb_id and consumer_id are provided', async () => {
    const START_DATE = '2024-04-01T09:00:00Z';
    const END_DATE = '2024-04-30T09:00:00Z';
    const SUBURB_ID = 1;
    const CONSUMER_ID = 1;

    const response = await request(appInstance)
      .post('/retailer/reports')
      .send({
        start_date: START_DATE,
        end_date: END_DATE,
        for: {
          suburb_id: SUBURB_ID,
          consumer_id: CONSUMER_ID,
        },
      });

    expect(response.status).toBe(400);
  });
});

describe('GET /retailer/reports/:id', () => {
  let sequelize: Sequelize;
  let appInstance: Application;
  const testSuburbs = [
    {
      id: 0,
      name: 'Test Suburb 1',
      postcode: 3000,
      state: 'Victoria',
      latitude: 100,
      longitude: 100,
    },
    {
      id: 1,
      name: 'Test Suburb 2',
      postcode: 3001,
      state: 'Victoria',
      latitude: 105,
      longitude: 100,
    },
    {
      id: 2,
      name: 'Test Suburb 3',
      postcode: 3002,
      state: 'Victoria',
      latitude: 115,
      longitude: 110,
    },
  ];
  const testConsumer = {
    id: 1,
    street_address: 'Test Address 1',
    latitude: 100,
    longitude: 100,
    high_priority: false,
    suburb_id: 1,
  };
  const testConsumerConsumptions = [
    { date: '2024-02-02T00:00:00.000Z', amount: 1, consumer_id: 1 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1, consumer_id: 1 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1, consumer_id: 1 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1, consumer_id: 1 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1, consumer_id: 1 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1, consumer_id: 1 },
  ];
  const testSuburbConsumptions = [
    { date: '2024-02-02T00:00:00.000Z', amount: 1, suburb_id: 1 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1, suburb_id: 1 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1, suburb_id: 1 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1, suburb_id: 1 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1, suburb_id: 1 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1, suburb_id: 1 },
  ];
  const testSellingPrice = [
    { date: '2024-02-02T00:00:00.000Z', amount: 1 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1 },
  ];
  const testSpotPrice = [
    { date: '2024-02-02T00:00:00.000Z', amount: 1 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1 },
  ];
  const testGeneratorType = [
    {
      id: 0,
      category: 'Brown Coal',
      renewable: false,
    },
    {
      id: 1,
      category: 'Solar',
      renewable: true,
    },
    {
      id: 2,
      category: 'Wind',
      renewable: true,
    },
  ];
  const testEnergyGenerator = [
    {
      id: 0,
      name: 'Coal Generator',
      suburb_id: 1,
      generator_type_id: 0,
    },
    {
      id: 1,
      name: 'Solar Generator 1',
      suburb_id: 1,
      generator_type_id: 1,
    },
    {
      id: 2,
      name: 'Solar Generator 2',
      suburb_id: 1,
      generator_type_id: 1,
    },
    {
      id: 3,
      name: 'Wind Generator',
      suburb_id: 1,
      generator_type_id: 2,
    },
    // generator that shouldnt be included in any reports
    {
      id: 4,
      name: 'Extra Wind Generator',
      suburb_id: 2,
      generator_type_id: 2,
    },
  ];
  const testEnergyGeneration = [
    //coal energy
    { date: '2024-02-02T09:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-03T09:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-04T09:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-05T09:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-06T09:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-07T09:00:00.000Z', amount: 1, energy_generator_id: 0 },
    //outside of range energy
    { date: '2024-05-06T09:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-05-07T09:00:00.000Z', amount: 1, energy_generator_id: 0 },
    //solar 1 energy
    { date: '2024-02-02T09:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-03T09:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-04T09:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-05T09:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-06T09:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-07T09:00:00.000Z', amount: 1, energy_generator_id: 1 },
    //outside of range energy
    { date: '2024-05-06T09:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-05-07T09:00:00.000Z', amount: 1, energy_generator_id: 1 },
    // solar 2 energy
    { date: '2024-02-02T09:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-03T09:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-04T09:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-05T09:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-06T09:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-07T09:00:00.000Z', amount: 1, energy_generator_id: 2 },
    // wind energy
    { date: '2024-02-02T09:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-03T09:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-04T09:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-05T09:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-06T09:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-07T09:00:00.000Z', amount: 1, energy_generator_id: 3 },
    // extra wind energy that shouldn't appear in any reports
    { date: '2024-02-02T09:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-03T09:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-04T09:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-05T09:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-06T09:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-07T09:00:00.000Z', amount: 1, energy_generator_id: 4 },
  ];

  const testReports = [
    // This report's suburb will have no energy but will have profit
    {
      id: '0',
      start_date: '2024-02-01T00:00:00.000Z',
      end_date: '2024-03-01T00:00:00.000Z',
      suburb_id: 0,
      consumer_id: null,
    },
    // This report's dates will have no data
    {
      id: '1',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-02-01T00:00:00.000Z',
      suburb_id: 1,
      consumer_id: null,
    },
    // This report will have data
    {
      id: '2',
      start_date: '2024-02-01T00:00:00.000Z',
      end_date: '2024-03-01T00:00:00.000Z',
      suburb_id: 1,
      consumer_id: null,
    },
    {
      id: '3',
      start_date: '2024-02-01T00:00:00.000Z',
      end_date: '2024-03-01T00:00:00.000Z',
      suburb_id: null,
      consumer_id: 1,
    },
  ];

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);
    const models = appInstance.get('models');

    // Create mock data
    await models.Suburb.bulkCreate(testSuburbs);
    await models.Consumer.create(testConsumer);
    await models.ConsumerConsumption.bulkCreate(testConsumerConsumptions);
    await models.SuburbConsumption.bulkCreate(testSuburbConsumptions);

    await models.SellingPrice.bulkCreate(testSellingPrice);
    await models.SpotPrice.bulkCreate(testSpotPrice);

    await models.GeneratorType.bulkCreate(testGeneratorType);
    await models.EnergyGenerator.bulkCreate(testEnergyGenerator);
    await models.EnergyGeneration.bulkCreate(testEnergyGeneration);

    await models.Report.bulkCreate(testReports);

    await models.GoalType.create({
      id: 4,
      category: 'green_energy',
      description:
        'I want the majority of my energy to come from environmentally-friendly sources.',
      target_type: 'consumer',
    });

    await models.WarningType.create({
      id: 6,
      category: 'fossil_fuels',
      description: 'High usage of energy from fossil fuel sources',
      trigger_greater_than: true,
      target: 0.5,
      goal_type_id: 4,
    });
  });

  afterAll(async () => {
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('Should return no report found', async () => {
    const response = await request(appInstance).get('/retailer/reports/10');

    expect(response.status).toBe(404);
  });

  it('Should return report with no energy', async () => {
    const testReport = testReports[0];
    const response = await request(appInstance).get(
      `/retailer/reports/${testReport.id}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: testReport.id,
      start_date: testReport.start_date,
      end_date: testReport.end_date,
      for: {
        suburb_id: testReport.suburb_id,
        consumer_id: testReport.consumer_id,
      },
      energy: {
        consumption: [],
        generation: [],
        green_energy: {
          green_usage_percent: null,
          green_goal_percent: null,
        },
        sources: [],
      },
      profits: [
        { date: '2024-01-29T00:00:00.000Z', amount: 0 },
        { date: '2024-02-05T00:00:00.000Z', amount: 0 },
      ],
      selling_prices: [
        { date: '2024-01-29T00:00:00.000Z', amount: 1 },
        { date: '2024-02-05T00:00:00.000Z', amount: 1 },
      ],
      spot_prices: [
        { date: '2024-01-29T00:00:00.000Z', amount: 1 },
        { date: '2024-02-05T00:00:00.000Z', amount: 1 },
      ],
    });
  });

  it('Should return a full suburb report', async () => {
    const testReport = testReports[2];
    const response = await request(appInstance).get(
      `/retailer/reports/${testReport.id}`
    );

    const hourDifference = differenceInHours(
      testReport.end_date,
      testReport.start_date
    );

    console.log(response.body);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: testReport.id,
      start_date: testReport.start_date,
      end_date: testReport.end_date,
      for: {
        suburb_id: testReport.suburb_id,
        consumer_id: testReport.consumer_id,
      },
      energy: {
        consumption: [
          {
            date: '2024-01-29T00:00:00.000Z',
            amount: 168,
          },
          {
            date: '2024-02-05T00:00:00.000Z',
            amount: 168,
          },
        ],
        generation: [
          {
            date: '2024-01-29T00:00:00.000Z',
            amount: 168,
          },
          {
            date: '2024-02-05T00:00:00.000Z',
            amount: 168,
          },
        ],
        green_energy: {
          green_usage_percent: 0.75,
          green_goal_percent: 1.5,
        },
        sources: [
          {
            category: 'Brown Coal',
            renewable: false,
            percentage: 0.25,
            amount: 1 * hourDifference,
          },
          {
            category: 'Solar',
            renewable: true,
            percentage: 0.5,
            amount: 2 * hourDifference,
          },
          {
            category: 'Wind',
            renewable: true,
            percentage: 0.25,
            amount: 1 * hourDifference,
          },
        ],
      },
      selling_prices: [
        { date: '2024-01-29T00:00:00.000Z', amount: 1 },
        { date: '2024-02-05T00:00:00.000Z', amount: 1 },
      ],
      spot_prices: [
        { date: '2024-01-29T00:00:00.000Z', amount: 1 },
        { date: '2024-02-05T00:00:00.000Z', amount: 1 },
      ],
      profits: [
        {
          date: '2024-01-29T00:00:00.000Z',
          amount: 0,
        },
        {
          date: '2024-02-05T00:00:00.000Z',
          amount: 0,
        },
      ],
    });
  });

  it('Should return a full consumer report', async () => {
    const testReport = testReports[3];
    const response = await request(appInstance).get(
      `/retailer/reports/${testReport.id}`
    );

    const hourDifference = differenceInHours(
      testReport.end_date,
      testReport.start_date
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: testReport.id,
      start_date: testReport.start_date,
      end_date: testReport.end_date,
      for: {
        suburb_id: testReport.suburb_id,
        consumer_id: testReport.consumer_id,
      },
      energy: {
        consumption: [
          {
            date: '2024-01-29T00:00:00.000Z',
            amount: 168,
          },
          {
            date: '2024-02-05T00:00:00.000Z',
            amount: 168,
          },
        ],
        green_energy: {
          green_usage_percent: 0.75,
          green_goal_percent: 1.5,
        },
        sources: [
          {
            category: 'Brown Coal',
            renewable: false,
            percentage: 0.25,
            amount: 1 * hourDifference,
          },
          {
            category: 'Solar',
            renewable: true,
            percentage: 0.5,
            amount: 2 * hourDifference,
          },
          {
            category: 'Wind',
            renewable: true,
            percentage: 0.25,
            amount: 1 * hourDifference,
          },
        ],
      },
      spending: [
        {
          date: '2024-01-29T00:00:00.000Z',
          amount: 168,
        },
        {
          date: '2024-02-05T00:00:00.000Z',
          amount: 168,
        },
      ],
    });
  });

  it('Should return empty report', async () => {
    const testReport = testReports[1];
    const response = await request(appInstance).get(
      `/retailer/reports/${testReport.id}`
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: testReport.id,
      start_date: testReport.start_date,
      end_date: testReport.end_date,
      for: {
        suburb_id: testReport.suburb_id,
        consumer_id: testReport.consumer_id,
      },
      energy: {
        consumption: [],
        generation: [],
        green_energy: {
          green_usage_percent: null,
          green_goal_percent: null,
        },
        sources: [],
      },
      selling_prices: [],
      spot_prices: [],
      profits: [],
    });
  });
});
