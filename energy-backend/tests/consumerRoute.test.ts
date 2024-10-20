import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import { addYears } from 'date-fns';

describe('GET /consumer/buyingPrice', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const sellingPriceTestData = [
    {
      date: '2024-01-01T10:00:00.000Z',
      amount: 0.5,
    },
    {
      date: '2024-01-10T12:00:00.000Z',
      amount: 1.2,
    },
    {
      date: '2024-01-05T11:00:00.000Z',
      amount: 0.6,
    },
  ];

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  afterEach(async () => {
    // Clear the SellingPrice table
    await appInstance.get('models').SellingPrice.destroy({
      where: {},
      truncate: true,
    });
  });

  it('should return error 404 for no buying price', async () => {
    const response = await request(appInstance).get('/consumer/buyingPrice');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'No buying price found',
    });
  });

  it('should return the latest retailer selling price', async () => {
    const { SellingPrice } = await appInstance.get('models');
    // Insert prerequesite data for tests
    await SellingPrice.bulkCreate(sellingPriceTestData);

    const response = await request(appInstance).get('/consumer/buyingPrice');

    // Get the latest selling price from the test data
    const expectedSellingPrice = sellingPriceTestData.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })[0];

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      date: expectedSellingPrice.date,
      amount: expectedSellingPrice.amount,
    });
  });
});

describe('GET /consumer/spending', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const mockConsumerConsumptionData = [
    { consumer_id: 1, date: '2024-01-01T09:00:00Z', amount: 100 },
    { consumer_id: 1, date: '2024-01-01T10:00:00Z', amount: 100 },
    { consumer_id: 1, date: '2024-01-02T09:00:00Z', amount: 100 },
    { consumer_id: 1, date: '2024-01-03T09:00:00Z', amount: 100 },
    { consumer_id: 1, date: '2024-01-04T09:00:00Z', amount: 100 },
    { consumer_id: 1, date: '2024-01-05T09:00:00Z', amount: 100 },
    { consumer_id: 1, date: '2024-01-06T09:00:00Z', amount: 100 },
    { consumer_id: 1, date: '2024-01-07T09:00:00Z', amount: 100 },
  ];

  const mockSellingPriceData = [
    {
      date: '2024-01-01T09:00:00.000Z',
      amount: 2,
    },
    {
      date: '2024-01-03T09:00:00.000Z',
      amount: 4,
    },
    {
      date: '2024-01-09T09:00:00.000Z',
      amount: 6,
    },
  ];

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    await appInstance.get('models').Suburb.create({
      id: 1,
      name: 'Test Suburb',
      postcode: 3000,
      state: 'Victoria',
      latitude: 0,
      longitude: 0,
    });

    await appInstance
      .get('models')
      .SellingPrice.bulkCreate(mockSellingPriceData);
    await appInstance.get('models').Consumer.create({
      id: 1,
      street_address: '10 Test Street Melbourne Victoria 3000',
      latitude: 0,
      longitude: 0,
      high_priority: false,
      suburb_id: 1,
    });

    await appInstance
      .get('models')
      .ConsumerConsumption.bulkCreate(mockConsumerConsumptionData);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return error 400 if start date is missing', async () => {
    const response = await request(appInstance).get('/consumer/spending');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Start date must be provided.',
    });
  });

  it('should return error 400 if invalid start date format is provided', async () => {
    const START_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid start date format. Provide dates in ISO string format.',
    });
  });

  it('should return error 400 if invalid end date format is provided', async () => {
    const START_DATE = '2024-01-01T09:00:00.000Z';
    const END_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid end date format. Provide dates in ISO string format.',
    });
  });

  it('should return error 400 if start_date provided is after end_date', async () => {
    const START_DATE = '2024-06-10T09:00:00.000Z'; // Date is afte end_date
    const END_DATE = '2022-06-10T09:00:00.000Z';

    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Start date must be before end date.',
    });
  });

  it('should return error 400 if end_date provided is in the future', async () => {
    const START_DATE = new Date().toISOString();
    const END_DATE = addYears(new Date(), 1).toISOString(); // end_date is in the future

    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'End date must not be in the future.',
    });
  });

  it('should return empty array if no data exists', async () => {
    const START_DATE = '2024-06-01T00:00:00.000Z';
    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      spending: [],
    });
  });

  it('should return empty array if consumer does not exist', async () => {
    const START_DATE = '2024-01-01T00:00:00.000Z';
    const CONSUMER_ID = 1000;
    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}&consumer_id=${CONSUMER_ID}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      consumer_id: CONSUMER_ID,
      spending: [],
    });
  });

  it('should return consumer spending data with weekly granularity', async () => {
    const START_DATE = '2024-01-01T00:00:00.000Z';
    const CONSUMER_ID = 1;
    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}&consumer_id=${CONSUMER_ID}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      consumer_id: CONSUMER_ID,
      spending: [
        {
          date: '2024-01-01T00:00:00.000Z',
          amount: 100 * 3 * 24 * 7, // average selling price for 1st week of 2024 is (2+4)/2 = 3
        },
        {
          date: '2024-01-08T00:00:00.000Z',
          amount: 100 * 6 * 24 * 7,
        },
      ],
    });
  });

  it('should return consumer spending data with daily granularity', async () => {
    const START_DATE = '2024-01-01T00:00:00.000Z';
    const END_DATE = '2024-01-11T00:00:00.000Z';
    const CONSUMER_ID = 1;
    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}&end_date=${END_DATE}&consumer_id=${CONSUMER_ID}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      consumer_id: CONSUMER_ID,
      spending: [
        {
          date: '2024-01-01T00:00:00.000Z',
          amount: 200 * 24,
        },
        {
          date: '2024-01-02T00:00:00.000Z',
          amount: 200 * 24,
        },
        {
          date: '2024-01-03T00:00:00.000Z',
          amount: 400 * 24,
        },
        {
          date: '2024-01-04T00:00:00.000Z',
          amount: 400 * 24,
        },
        {
          date: '2024-01-05T00:00:00.000Z',
          amount: 400 * 24,
        },
        {
          date: '2024-01-06T00:00:00.000Z',
          amount: 400 * 24,
        },
        {
          date: '2024-01-07T00:00:00.000Z',
          amount: 400 * 24,
        },
        {
          date: '2024-01-09T00:00:00.000Z',
          amount: 600 * 24,
        },
      ],
    });
  });

  it('should return consumer spending data with hourly granularity', async () => {
    const START_DATE = '2024-01-01T00:00:00.000Z';
    const END_DATE = '2024-01-01T13:00:00.000Z';
    const CONSUMER_ID = 1;
    const response = await request(appInstance).get(
      `/consumer/spending?start_date=${START_DATE}&end_date=${END_DATE}&consumer_id=${CONSUMER_ID}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      consumer_id: CONSUMER_ID,
      spending: [
        {
          date: '2024-01-01T09:00:00.000Z',
          amount: 200,
        },
        {
          date: '2024-01-01T10:00:00.000Z',
          amount: 200,
        },
      ],
    });
  });
});
