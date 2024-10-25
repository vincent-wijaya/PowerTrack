// Set node enviornment to Test
process.env.NODE_ENV = 'test';

import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import { addYears, startOfHour, startOfISOWeek, subMinutes } from 'date-fns';

describe('GET /retailer/profitMargin', () => {
  let sequelize: Sequelize;
  let appInstance: Application;
  const spotPriceTestData = [
    { date: new Date('2024-01-01T11:00:00'), amount: 3 },
    { date: new Date('2024-01-02T11:00:00'), amount: 3 },
    { date: new Date('2024-01-03T11:10:00'), amount: 3 },
    { date: new Date('2024-01-04T11:10:00'), amount: 3 },
    { date: new Date('2024-01-05T11:10:00'), amount: 3 },
  ];
  const sellingPriceTestData = [
    { date: new Date('2024-01-01T11:10:00'), amount: 4 },
    { date: new Date('2024-01-02T11:10:00'), amount: 4 },
    { date: new Date('2024-01-03T11:10:00'), amount: 4 },
    { date: new Date('2024-01-04T11:00:00'), amount: 4 },
    { date: new Date('2024-01-05T11:00:00'), amount: 4 },
  ];

  const startDate = new Date('2024-01-01T11:10:00');
  const endDate = new Date('2024-01-05T11:00:00');

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);
    const { SpotPrice, SellingPrice } = await appInstance.get('models');
    // Insert prerequesite data for tests
    await SpotPrice.bulkCreate(spotPriceTestData);
    await SellingPrice.bulkCreate(sellingPriceTestData);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return error 400 if start date is missing', async () => {
    const response = await request(appInstance).get('/retailer/profitMargin');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Start date must be provided.',
    });
  });

  it('should return error 400 if invalid start date format is provided', async () => {
    const START_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/profitMargin?start_date=${START_DATE}`
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
      `/retailer/profitMargin?start_date=${START_DATE}&end_date=${END_DATE}`
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
      `/retailer/profitMargin?start_date=${START_DATE}&end_date=${END_DATE}`
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
      `/retailer/profitMargin?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'End date must not be in the future.',
    });
  });

  it('should return all data after the start date', async () => {
    const response = await request(appInstance).get(
      `/retailer/profitMargin?start_date=${startDate.toISOString()}`
    );

    const adjustedSellingPrices = sellingPriceTestData.map((sellingPrice) => {
      return {
        ...sellingPrice,
        truncatedDate: startOfISOWeek(sellingPrice.date).toISOString(),
      };
    });

    const adjustedSpotPrices = spotPriceTestData.map((spotPrice) => {
      return {
        ...spotPrice,
        truncatedDate: startOfISOWeek(spotPrice.date).toISOString(),
      };
    });

    let expectedSellingPrices = adjustedSellingPrices
      .filter((sellingPrice) => sellingPrice.date > startDate)
      .reduce((acc: any, sellingPrice: any) => {
        if (!acc[sellingPrice.truncatedDate]) {
          acc[sellingPrice.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[sellingPrice.truncatedDate].amount += sellingPrice.amount;
        acc[sellingPrice.truncatedDate].count++;
        return acc;
      }, {});

    expectedSellingPrices = Object.keys(expectedSellingPrices).map((date) => {
      return {
        date,
        amount:
          expectedSellingPrices[date].amount /
          expectedSellingPrices[date].count,
      };
    });

    let expectedSpotPrices = adjustedSpotPrices
      .filter((spotPrice) => spotPrice.date > startDate)
      .reduce((acc: any, spotPrice: any) => {
        if (!acc[spotPrice.truncatedDate]) {
          acc[spotPrice.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[spotPrice.truncatedDate].amount += spotPrice.amount;
        acc[spotPrice.truncatedDate].count++;
        return acc;
      }, {});

    expectedSpotPrices = Object.keys(expectedSpotPrices).map((date) => {
      return {
        date,
        amount:
          expectedSpotPrices[date].amount / expectedSpotPrices[date].count,
      };
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: startDate.toISOString(),
      values: {
        selling_prices: expectedSellingPrices,
        spot_prices: expectedSpotPrices,
        profits: [
          { date: new Date('2024-01-01T00:00:00').toISOString(), amount: 1 }, // Profit of the only month in the period is 4-3 = 1
        ],
      },
    });
  });

  it('should return all data between the start date and end date', async () => {
    const response = await request(appInstance).get(
      `/retailer/profitMargin?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`
    );

    let expectedSellingPrice = sellingPriceTestData
      .filter((price) => price.date > startDate && price.date <= endDate) // filter to after start date and before end date
      .map((data) => ({
        date: startOfHour(data.date).toISOString(),
        amount: data.amount,
      }));
    expectedSellingPrice.sort(
      (a: any, b: any) =>
        new Date(a.date).valueOf() - new Date(b.date).valueOf()
    );

    let expectedSpotPrice = spotPriceTestData
      .filter((price) => price.date > startDate && price.date <= endDate) // filter to after start date and before end date
      .map((data) => ({
        date: startOfHour(data.date).toISOString(),
        amount: data.amount,
      }));
    expectedSpotPrice.sort(
      (a: any, b: any) =>
        new Date(a.date).valueOf() - new Date(b.date).valueOf()
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      values: {
        selling_prices: expectedSellingPrice,
        spot_prices: expectedSpotPrice,
        profits: [
          { date: new Date('2024-01-02T11:00:00').toISOString(), amount: 1 }, // 1 January 2024 has no value as the prices were stored before the startDate of this query
          { date: new Date('2024-01-03T11:00:00').toISOString(), amount: 1 },
          { date: new Date('2024-01-04T11:00:00').toISOString(), amount: 1 },
          { date: new Date('2024-01-05T11:00:00').toISOString(), amount: 1 },
        ],
      },
    });
  });
});

describe('GET /retailer/warnings - category outage_hp', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const highPriorityConsumerAddress = '10 Test Street Melbourne Victoria 3000';

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Insert prerequesite data for tests
    await appInstance.get('models').Suburb.bulkCreate([
      {
        id: 1,
        name: 'Test Suburb',
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
        latitude: 100,
        longitude: 100,
      },
    ]);
    await appInstance.get('models').Consumer.bulkCreate([
      {
        id: 1,
        street_address: highPriorityConsumerAddress,
        latitude: 100,
        longitude: 100,
        high_priority: true,
        suburb_id: 1,
      },
      {
        id: 2,
        street_address: highPriorityConsumerAddress,
        latitude: 100,
        longitude: 100,
        high_priority: true,
        suburb_id: 2,
      },
    ]);
    await appInstance.get('models').ConsumerConsumption.bulkCreate([
      {
        consumer_id: 1,
        date: subMinutes(new Date(), 3), // < 5 minutes => no power outage
        amount: 10,
      },
      {
        consumer_id: 2,
        date: subMinutes(new Date(), 6), // > 5 minutes => power outage
        amount: 0,
      },
    ]);
    await appInstance.get('models').GoalType.create({
      id: 3,
      category: 'contract',
      description:
        'I want to prioritise supplying power for specific consumers I have a contract with',
      target_type: 'retailer',
    });
    await appInstance.get('models').WarningType.create({
      id: 1,
      goal_type_id: 3,
      category: 'outage_hp',
      description: 'Energy outage for high priority consumer',
      trigger_greater_than: false,
      target: 0,
    });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should not return an outage_hp warning', async () => {
    const response = await request(appInstance).get(
      '/retailer/warnings?suburb_id=1'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);

    console.log(`API response: ${JSON.stringify(response.body)}`);
    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'outage_hp'
    );
    expect(relevantWarnings).toEqual([]);
  });

  it('should return an outage_hp warning', async () => {
    const response = await request(appInstance).get(
      '/retailer/warnings?suburb_id=2'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'outage_hp'
    );
    expect(relevantWarnings.length).toBe(1);
    expect(relevantWarnings[0].data).toEqual({
      consumer_id: 2,
      street_address: highPriorityConsumerAddress,
    });
  });

  it('should return an outage_hp warning (with no suburb or consumer provided', async () => {
    const response = await request(appInstance).get('/retailer/warnings');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'outage_hp'
    );
    expect(relevantWarnings.length).toBe(1);
    expect(relevantWarnings[0].data).toEqual({
      consumer_id: 2,
      street_address: highPriorityConsumerAddress,
    });
  });
});

describe('GET /retailer/warnings - category high_cost', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const address1 = '10 Test Street Melbourne Victoria 3000';

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Insert prerequesite data for tests
    await appInstance.get('models').Suburb.create({
      id: 1,
      name: 'Test Suburb',
      postcode: 3000,
      state: 'Victoria',
      latitude: 100,
      longitude: 100,
    });
    await appInstance.get('models').Consumer.create({
      id: 1,
      street_address: address1,
      latitude: 100,
      longitude: 100,
      high_priority: false,
      suburb_id: 1,
    });
    await appInstance.get('models').GoalType.create({
      id: 6,
      category: 'low_expense',
      description: 'I want to spend less money on energy.',
      target_type: 'consumer',
    });
    await appInstance.get('models').WarningType.create({
      id: 8,
      goal_type_id: 6,
      category: 'high_cost',
      description: 'Cost of energy is high right now.',
      trigger_greater_than: true,
      target: 0.5,
    });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should not return a high_cost warning and then later return a high_cost warning', async () => {
    let response;
    let relevantWarnings;

    // Add a low cost selling price to not trigger the warning
    await appInstance.get('models').SellingPrice.create({
      date: '2024-04-17T09:00:00Z',
      amount: 0.25,
    });

    response = await request(appInstance).get(
      '/retailer/warnings?consumer_id=1'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);

    console.log(`API response: ${JSON.stringify(response.body)}`);
    relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'high_cost'
    );
    expect(relevantWarnings).toEqual([]);

    // Add a high cost selling price to trigger the warning
    await appInstance.get('models').SellingPrice.create({
      date: '2024-04-17T10:00:00Z',
      amount: 0.5,
    });

    response = await request(appInstance).get(
      '/retailer/warnings?consumer_id=1'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);

    console.log(`API response: ${JSON.stringify(response.body)}`);
    relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'high_cost'
    );
    expect(relevantWarnings.length).toBe(1);
    expect(relevantWarnings[0].data).toEqual({
      energy_cost: '0.5',
    });
  });
});

describe('GET /retailer/warnings - category high_usage', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Insert prerequesite data for tests
    await appInstance.get('models').Suburb.bulkCreate([
      {
        id: 1,
        name: 'Test Suburb',
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
        latitude: 100,
        longitude: 100,
      },
    ]);
    await appInstance.get('models').GeneratorType.create({
      id: 1,
      category: 'Natural Gas Pipeline',
      renewable: false,
    });
    await appInstance.get('models').EnergyGenerator.bulkCreate([
      {
        id: 1,
        name: 'Test Generator 1',
        generator_type_id: 1,
        suburb_id: 1,
      },
      {
        id: 2,
        name: 'Test Generator 2',
        generator_type_id: 1,
        suburb_id: 2,
      },
    ]);

    await appInstance.get('models').SuburbConsumption.create({
      amount: 10,
      date: new Date().toISOString(),
      suburb_id: 1,
    });
    await appInstance.get('models').SuburbConsumption.create({
      amount: 8,
      date: new Date().toISOString(),
      suburb_id: 2,
    });
    await appInstance.get('models').EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 1,
    });
    await appInstance.get('models').EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 2,
    });
    await appInstance.get('models').GoalType.create({
      id: 1,
      category: 'profit',
      description:
        'I want to sell most/all of the energy I buy. Sell energy for more than I bought it for.',
      target_type: 'retailer',
    });
    await appInstance.get('models').WarningType.create({
      id: 1,
      goal_type_id: 1,
      category: 'high_usage',
      description: 'Too much energy used in the grid',
      trigger_greater_than: true,
      target: 0.85,
    });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should not return a high_usage warning', async () => {
    const response = await request(appInstance).get(
      '/retailer/warnings?suburb_id=2'
    );

    expect(response.status).toBe(200);

    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'high_usage'
    );
    expect(relevantWarnings).toEqual([]);
  });

  it('should return a high_usage warning', async () => {
    const response = await request(appInstance).get(
      '/retailer/warnings?suburb_id=1'
    );

    expect(response.status).toBe(200);
    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'high_usage'
    );
    expect(relevantWarnings.length).toBe(1);
    expect(relevantWarnings[0].data).toEqual({
      energy_utilised_percentage: 1,
    });
  });

  it('should return an high_usage warning (with no suburb or consumer provided', async () => {
    const response = await request(appInstance).get('/retailer/warnings');

    expect(response.status).toBe(200);
    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'high_usage'
    );
    expect(relevantWarnings.length).toBe(1);
    expect(relevantWarnings[0].data).toEqual({
      energy_utilised_percentage: 0.9,
    });
  });
});

describe('GET /retailer/warnings - category low_usage', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Insert prerequesite data for tests
    await appInstance.get('models').Suburb.bulkCreate([
      {
        id: 1,
        name: 'Test Suburb',
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
        latitude: 100,
        longitude: 100,
      },
    ]);
    await appInstance.get('models').GeneratorType.create({
      id: 1,
      category: 'Natural Gas Pipeline',
      renewable: false,
    });
    await appInstance.get('models').EnergyGenerator.bulkCreate([
      {
        id: 1,
        name: 'Test Generator 1',
        generator_type_id: 1,
        suburb_id: 1,
      },
      {
        id: 2,
        name: 'Test Generator 2',
        generator_type_id: 1,
        suburb_id: 2,
      },
    ]);

    await appInstance.get('models').SuburbConsumption.create({
      amount: 1,
      date: new Date().toISOString(),
      suburb_id: 1,
    });
    await appInstance.get('models').SuburbConsumption.create({
      amount: 1,
      date: new Date().toISOString(),
      suburb_id: 1,
    });
    await appInstance.get('models').SuburbConsumption.create({
      amount: 10,
      date: new Date().toISOString(),
      suburb_id: 2,
    });
    await appInstance.get('models').EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 1,
    });
    await appInstance.get('models').EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 1,
    });
    await appInstance.get('models').EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 2,
    });
    await appInstance.get('models').GoalType.create({
      id: 1,
      category: 'profit',
      description:
        'I want to sell most/all of the energy I buy. Sell energy for more than I bought it for.',
      target_type: 'retailer',
    });
    await appInstance.get('models').WarningType.create({
      id: 1,
      goal_type_id: 1,
      category: 'low_usage',
      description: 'Too much unused energy in the grid',
      trigger_greater_than: false,
      target: 0.5,
    });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should not return a low_usage warning', async () => {
    const response = await request(appInstance).get(
      '/retailer/warnings?suburb_id=2'
    );

    expect(response.status).toBe(200);

    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'low_usage'
    );
    expect(relevantWarnings).toEqual([]);
  });

  it('should return a low_usage warning', async () => {
    const response = await request(appInstance).get(
      '/retailer/warnings?suburb_id=1'
    );

    expect(response.status).toBe(200);
    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'low_usage'
    );
    expect(relevantWarnings.length).toBe(1);
    expect(relevantWarnings[0].data).toEqual({
      energy_utilised_percentage: 0.1,
    });
  });

  it('should return an low_usage warning (with no suburb or consumer provided', async () => {
    const response = await request(appInstance).get('/retailer/warnings');

    expect(response.status).toBe(200);
    let relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'low_usage'
    );
    expect(relevantWarnings.length).toBe(1);
    expect(relevantWarnings[0].data).toEqual({
      energy_utilised_percentage: 0.4,
    });
  });
});

describe('GET /retailer/warnings - category high_spot_price', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const address1 = '10 Test Street Melbourne Victoria 3000';

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Insert prerequesite data for tests
    await appInstance.get('models').Suburb.create({
      id: 1,
      name: 'Test Suburb',
      postcode: 3000,
      state: 'Victoria',
      latitude: 100,
      longitude: 100,
    });
    await appInstance.get('models').Consumer.create({
      id: 1,
      street_address: address1,
      high_priority: false,
      suburb_id: 1,
      latitude: 100,
      longitude: 100,
    });
    await appInstance.get('models').GoalType.create({
      id: 4,
      category: 'green_energy',
      description:
        'I want the majority of my energy to come from environmentally-friendly sources.',
      target_type: 'consumer',
    });
    await appInstance.get('models').WarningType.create({
      id: 9,
      goal_type_id: 4,
      category: 'high_spot_price',
      description: 'Return for selling energy is high right now.',
      trigger_greater_than: true,
      target: 0.8,
    });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should not return a high_spot_price warning and then later return a high_spot_price warning', async () => {
    let response;
    let relevantWarnings;

    // Add a low cost selling price to not trigger the warning
    await appInstance.get('models').SpotPrice.create({
      date: '2024-04-17T09:00:00Z',
      amount: 0.25,
    });

    response = await request(appInstance).get(
      '/retailer/warnings?consumer_id=1'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);

    console.log(`API response: ${JSON.stringify(response.body)}`);
    relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'high_spot_price'
    );
    expect(relevantWarnings).toEqual([]);

    // Add a high cost selling price to trigger the warning
    await appInstance.get('models').SpotPrice.create({
      date: '2024-04-17T10:00:00Z',
      amount: 0.8,
    });

    response = await request(appInstance).get(
      '/retailer/warnings?consumer_id=1'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);

    console.log(`API response: ${JSON.stringify(response.body)}`);
    relevantWarnings = response.body.warnings.filter(
      (warning: any) => warning.category === 'high_spot_price'
    );
    expect(relevantWarnings.length).toBe(1);
    expect(relevantWarnings[0].data).toEqual({
      spot_price: '0.8',
    });
  });
});
