import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import moment from 'moment';

describe('GET /retailer/consumption', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

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
      latitude: 0,
      longitude: 0,
    });
    await appInstance.get('models').SuburbConsumption.bulkCreate([
      { suburb_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
      { suburb_id: 1, date: '2024-04-17T09:05:00Z', amount: 1100 },
      { suburb_id: 1, date: '2024-04-17T09:10:00Z', amount: 1200 },
      { suburb_id: 1, date: '2024-04-17T09:15:00Z', amount: 1300 },
    ]);
    await appInstance.get('models').SellingPrice.create({
      id: 1,
      date: '2024-04-01T09:00:00Z',
      amount: 0.25,
    });
    await appInstance.get('models').Consumer.create({
      id: 1,
      street_address: '10 Test Street Melbourne Victoria 3000',
      high_priority: false,
      selling_price_id: 1,
      suburb_id: 1,
    });
    await appInstance.get('models').ConsumerConsumption.bulkCreate([
      { consumer_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
      { consumer_id: 1, date: '2024-04-17T09:05:00Z', amount: 1100 },
      { consumer_id: 1, date: '2024-04-17T09:10:00Z', amount: 1200 },
      { consumer_id: 1, date: '2024-04-17T09:15:00Z', amount: 1300 },
    ]);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return non-empty data for a suburb', async () => {
    // Insert sample data into the database
    const SuburbConsumption = appInstance.get('models').SuburbConsumption;

    const suburbConsumptionData = await SuburbConsumption.findAll({
      where: { suburb_id: 1 },
    });

    const response = await request(appInstance).get(
      '/retailer/consumption?suburb_id=1&start_date=2024-04-17T09:05:00Z&end_date=2024-04-17T09:11:00Z'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect([
      suburbConsumptionData[1].toJSON(),
      suburbConsumptionData[2].toJSON(),
    ]).toEqual(
      response.body.energy.map((x: Object) =>
        SuburbConsumption.build(x).toJSON()
      )
    );
  });

  it('should return consumer data for all time', async () => {
    const SuburbConsumption = appInstance.get('models').SuburbConsumption;
    const suburbConsumptionData = await SuburbConsumption.findAll({
      where: { suburb_id: 1 },
    });

    const response = await request(appInstance).get(
      '/retailer/consumption?suburb_id=1'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(
      suburbConsumptionData.map((x: typeof SuburbConsumption) => x.toJSON())
    ).toEqual(
      response.body.energy.map((x: Object) =>
        SuburbConsumption.build(x).toJSON()
      )
    );
  });

  it('should return non-empty data for a consumer', async () => {
    // Insert sample data into the database
    const ConsumerConsumption = appInstance.get('models').ConsumerConsumption;
    const consumerConsumptionData = await ConsumerConsumption.findAll();

    const response = await request(appInstance).get(
      '/retailer/consumption?consumer_id=1&start_date=2024-04-17T09:05:00Z&end_date=2024-04-17T09:11:00Z'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect([
      consumerConsumptionData[1].toJSON(),
      consumerConsumptionData[2].toJSON(),
    ]).toEqual(
      response.body.energy.map((x: Object) =>
        ConsumerConsumption.build(x).toJSON()
      )
    );
  });

  it('should return consumer data for all time', async () => {
    const ConsumerConsumption = appInstance.get('models').ConsumerConsumption;
    const consumerConsumptionData = await ConsumerConsumption.findAll();

    const response = await request(appInstance).get(
      '/retailer/consumption?consumer_id=1'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(
      consumerConsumptionData.map((x: typeof ConsumerConsumption) => x.toJSON())
    ).toEqual(
      response.body.energy.map((x: Object) =>
        ConsumerConsumption.build(x).toJSON()
      )
    );
  });

  it('should return data for nation-wide consumption', async () => {
    const response = await request(appInstance).get(
      '/retailer/consumption?start_date=2024-04-17T09:05:00Z&end_date=2024-04-17T09:11:00Z'
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect([
      {
        suburb_id: '1',
        start_date: '2024-04-17T09:05:00Z',
        end_date: '2024-04-17T09:11:00Z',
        amount: '2300',
      },
    ]).toEqual(response.body.energy);
  });
});

describe('GET /retailer/map', () => {
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
        latitude: 105,
        longitude: 100,
      },
    ]);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return no data', async () => {
    const response = await request(appInstance).get(
      '/retailer/map?lat1=90&long1=90&lat2=110&long2=110'
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ energy: [] });
  });

  it('should return data for both suburbs', async () => {
    // Insert sample data into the database
    const SuburbConsumption = appInstance.get('models').SuburbConsumption;

    const suburbConsumptionData = await SuburbConsumption.bulkCreate([
      { suburb_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
      { suburb_id: 2, date: '2024-04-17T09:00:00Z', amount: 1100 },
    ]).catch((err: any) => console.log(err));

    const response = await request(appInstance).get('/retailer/map');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(response.body).toEqual({
      energy: suburbConsumptionData.map((x: typeof SuburbConsumption) => {
        return {
          suburb_id: x.suburb_id,
          consumption: x.amount,
          timestamp: x.date.toISOString(),
        };
      }),
    });
  });
});

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
    { date: new Date('2024-01-01T11:10:00'), amount: 2 },
    { date: new Date('2024-01-02T11:10:00'), amount: 2 },
    { date: new Date('2024-01-03T11:10:00'), amount: 2 },
    { date: new Date('2024-01-04T11:00:00'), amount: 2 },
    { date: new Date('2024-01-05T11:00:00'), amount: 2 },
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

  it('should return all data', async () => {
    const response = await request(appInstance).get('/retailer/profitMargin');

    let expectedSellingPrice = sellingPriceTestData.map((data) => ({
      date: data.date.toISOString(),
      amount: data.amount,
    }));
    expectedSellingPrice.sort(
      (a: any, b: any) =>
        new Date(a.date).valueOf() - new Date(b.date).valueOf()
    );

    let expectedSpotPrice = spotPriceTestData.map((data) => ({
      date: data.date.toISOString(),
      amount: data.amount,
    }));
    expectedSpotPrice.sort(
      (a: any, b: any) =>
        new Date(a.date).valueOf() - new Date(b.date).valueOf()
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      selling_prices: expectedSellingPrice,
      spot_prices: expectedSpotPrice,
    });
  });

  it('should return all data after the start date', async () => {
    const response = await request(appInstance).get(
      `/retailer/profitMargin?start_date=${startDate.toISOString()}`
    );

    let expectedSellingPrice = sellingPriceTestData
      .filter((price) => price.date > startDate) // filter to after start date
      .map((data) => ({
        date: data.date.toISOString(),
        amount: data.amount,
      }));
    expectedSellingPrice.sort(
      (a: any, b: any) =>
        new Date(a.date).valueOf() - new Date(b.date).valueOf()
    );

    let expectedSpotPrice = spotPriceTestData
      .filter((price) => price.date > startDate) // filter to after start date
      .map((data) => ({
        date: data.date.toISOString(),
        amount: data.amount,
      }));
    expectedSpotPrice.sort(
      (a: any, b: any) =>
        new Date(a.date).valueOf() - new Date(b.date).valueOf()
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      selling_prices: expectedSellingPrice,
      spot_prices: expectedSpotPrice,
    });
  });

  it('should return all data between the start date and end date', async () => {
    const response = await request(appInstance).get(
      `/retailer/profitMargin?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`
    );

    let expectedSellingPrice = sellingPriceTestData
      .filter((price) => price.date > startDate && price.date <= endDate) // filter to after start date and before end date
      .map((data) => ({
        date: data.date.toISOString(),
        amount: data.amount,
      }));
    expectedSellingPrice.sort(
      (a: any, b: any) =>
        new Date(a.date).valueOf() - new Date(b.date).valueOf()
    );

    let expectedSpotPrice = spotPriceTestData
      .filter((price) => price.date > startDate && price.date <= endDate) // filter to after start date and before end date
      .map((data) => ({
        date: data.date.toISOString(),
        amount: data.amount,
      }));
    expectedSpotPrice.sort(
      (a: any, b: any) =>
        new Date(a.date).valueOf() - new Date(b.date).valueOf()
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      selling_prices: expectedSellingPrice,
      spot_prices: expectedSpotPrice,
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
        high_priority: true,
        suburb_id: 1,
      },
      {
        id: 2,
        street_address: highPriorityConsumerAddress,
        high_priority: true,
        suburb_id: 2,
      },
    ]);
    await appInstance.get('models').ConsumerConsumption.bulkCreate([
      {
        consumer_id: 1,
        date: '2024-04-17T09:00:00Z',
        amount: 10,
      },
      {
        consumer_id: 2,
        date: '2024-04-17T09:00:00Z',
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

describe('GET /retailer/consumers', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

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

    await appInstance.get('models').Consumer.bulkCreate([
      {
        id: 1,
        street_address: '10 Test Street Melbourne Victoria 3000',
        high_priority: false,
        selling_price_id: 1,
        suburb_id: 1,
      },
      {
        id: 2,
        street_address: '20 Test Street Melbourne Victoria 3000',
        high_priority: true,
        selling_price_id: 1,
        suburb_id: 2,
      },
    ]);
  });

  afterAll(async () => {
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return all consumers', async () => {
    const response = await request(appInstance).get('/retailer/consumers');

    expect(response.status).toBe(200);
    expect(response.body.consumers.length).toBe(2);
  });

  it('should return consumers by suburb_id', async () => {
    const response = await request(appInstance).get(
      '/retailer/consumers?suburb_id=1'
    );

    expect(response.status).toBe(200);
    expect(response.body.consumers.length).toBe(1);
    expect(Number(response.body.consumers[0].suburb_id)).toBe(1); // Convert to number
  });

  it('should return a specific consumer by consumer_id', async () => {
    const response = await request(appInstance).get(
      '/retailer/consumers?consumer_id=1'
    );

    console.log('Response status:', response.status);
    console.log('Response body:', response.body);

    expect(response.status).toBe(200);
    expect(response.body.consumers.length).toBe(1);
    expect(response.body.consumers[0].id).toBe('1');
  });

  it('should return 400 if both suburb_id and consumer_id are specified', async () => {
    const response = await request(appInstance).get(
      '/retailer/consumers?suburb_id=1&consumer_id=1'
    );

    expect(response.status).toBe(400);
    expect(response.text).toBe('Cannot specify both suburb_id and consumer_id');
  });
});

describe('GET /retailer/generator', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const mockEnergyGenerations = [
    { energy_generator_id: 1, date: '2024-01-01T09:00:00Z', amount: 100 },
    { energy_generator_id: 1, date: '2024-02-01T09:00:00Z', amount: 200 },
    { energy_generator_id: 1, date: '2024-03-01T09:00:00Z', amount: 300 },
    { energy_generator_id: 1, date: '2024-04-01T09:00:00Z', amount: 400 },

    { energy_generator_id: 1, date: '2024-06-01T09:00:00Z', amount: 500 },
    { energy_generator_id: 1, date: '2024-06-02T10:00:00Z', amount: 500 },
    { energy_generator_id: 1, date: '2024-06-03T11:00:00Z', amount: 500 },

    { energy_generator_id: 2, date: '2024-01-01T09:00:00Z', amount: 100 },
    { energy_generator_id: 2, date: '2024-02-01T09:00:00Z', amount: 200 },
    { energy_generator_id: 2, date: '2024-03-01T09:00:00Z', amount: 300 },
    { energy_generator_id: 2, date: '2024-04-01T09:00:00Z', amount: 400 },

    { energy_generator_id: 2, date: '2024-06-01T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-06-02T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-06-03T09:00:00Z', amount: 500 },
  ];

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    const Suburb = appInstance.get('models').Suburb;
    const GeneratorType = appInstance.get('models').GeneratorType;
    const EnergyGenerator = appInstance.get('models').EnergyGenerator;
    const EnergyGeneration = appInstance.get('models').EnergyGeneration;

    // Insert prerequesite data for tests
    await Suburb.bulkCreate([
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
        latitude: 105,
        longitude: 100,
      },
    ]);

    await GeneratorType.create({
      id: 1,
      category: 'Test Generator',
      renewable: false,
    });
    await EnergyGenerator.bulkCreate([
      { id: 1, name: 'Test Generator', suburb_id: 1, generator_type_id: 1 },
      { id: 2, name: 'Test Generator 2', suburb_id: 2, generator_type_id: 1 },
    ]);

    await EnergyGeneration.bulkCreate(mockEnergyGenerations);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return error 400 if invalid suburb_id is provided', async () => {
    const SUBURB_ID = '1.111'; // Invalid suburb_id

    const response = await request(appInstance).get(
      `/retailer/generator?suburb_id=${SUBURB_ID}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if start date is missing', async () => {
    const response = await request(appInstance).get('/retailer/generator');

    expect(response.status).toBe(400);
  });

  it('should return error 400 if invalid start date format is provided', async () => {
    const START_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/generator?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if invalid end date format is provided', async () => {
    const START_DATE = '2024-01-01T09:00:00Z';
    const END_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/generator?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if future start date is provided', async () => {
    const START_DATE = '2026-06-10T09:00:00Z'; // Date is in the future

    const response = await request(appInstance).get(
      `/retailer/generator?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return energy generation of all generator in weekly time granularity', async () => {
    const START_DATE = '2024-06-01T09:00:00Z';
    const END_DATE = '2024-07-10T11:00:00Z';

    let expectedResponse = mockEnergyGenerations
      .filter(
        (generation) =>
          generation.date > START_DATE && generation.date <= END_DATE
      )
      .reduce((acc: any, generation: any) => {
        // Create a new generator if it doesn't exist
        if (!acc[generation.energy_generator_id]) {
          acc[generation.energy_generator_id] = {
            energy_generator_id: generation.energy_generator_id,
            energy: {},
          };
        }

        const truncatedDate = moment(generation.date)
          .startOf('isoWeek')
          .toISOString();
        // Set initial value to 0 if it doesn't exist yet
        if (!acc[generation.energy_generator_id].energy[truncatedDate]) {
          acc[generation.energy_generator_id].energy[truncatedDate] = 0;
        }

        // Add the amount to the existing value
        acc[generation.energy_generator_id].energy[truncatedDate] +=
          generation.amount;

        return acc;
      }, {});

    expectedResponse = Object.keys(expectedResponse).map((generatorId) => {
      return {
        energy_generator_id: parseInt(generatorId),
        energy: Object.entries(expectedResponse[generatorId].energy).map(
          ([date, amount]) => [date, amount]
        ),
      };
    });

    const response = await request(appInstance).get(
      `/retailer/generator?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      generators: expectedResponse,
    });
  });

  it('should return total energy generation of each generator in suburb in daily time granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2024-05-30T09:00:00Z';
    const END_DATE = '2024-06-07T09:00:00Z';

    let expectedResponse = mockEnergyGenerations
      .filter(
        (generation) =>
          generation.date > START_DATE && generation.energy_generator_id == 1
      )
      .reduce((acc: any, generation: any) => {
        // Create a new generator if it doesn't exist
        if (!acc[generation.energy_generator_id]) {
          acc[generation.energy_generator_id] = {
            energy_generator_id: generation.energy_generator_id,
            energy: {},
          };
        }

        const truncatedDate = moment(generation.date)
          .startOf('day')
          .toISOString();
        // Set initial value to 0 if it doesn't exist yet
        if (!acc[generation.energy_generator_id].energy[truncatedDate]) {
          acc[generation.energy_generator_id].energy[truncatedDate] = 0;
        }

        // Add the amount to the existing value
        acc[generation.energy_generator_id].energy[truncatedDate] +=
          generation.amount;

        return acc;
      }, {});

    expectedResponse = Object.keys(expectedResponse).map((generatorId) => {
      return {
        energy_generator_id: parseInt(generatorId),
        energy: Object.entries(expectedResponse[generatorId].energy).map(
          ([date, amount]) => [date, amount]
        ),
      };
    });

    const response = await request(appInstance).get(
      `/retailer/generator?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      generators: expectedResponse,
    });
  });

  it('should return total energy generation of each generator in suburb in hourly time granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2024-06-01T08:00:00Z';
    const END_DATE = '2024-06-07T09:00:00Z';

    let expectedResponse = mockEnergyGenerations
      .filter(
        (generation) =>
          generation.date > START_DATE &&
          generation.date <= END_DATE &&
          generation.energy_generator_id == 1
      )
      .reduce((acc: any, generation: any) => {
        // Create a new generator if it doesn't exist
        if (!acc[generation.energy_generator_id]) {
          acc[generation.energy_generator_id] = {
            energy_generator_id: generation.energy_generator_id,
            energy: {},
          };
        }

        const truncatedDate = moment(generation.date)
          .startOf('hour')
          .toISOString();
        // Set initial value to 0 if it doesn't exist yet
        if (!acc[generation.energy_generator_id].energy[truncatedDate]) {
          acc[generation.energy_generator_id].energy[truncatedDate] = 0;
        }

        // Add the amount to the existing value
        acc[generation.energy_generator_id].energy[truncatedDate] +=
          generation.amount;

        return acc;
      }, {});

    expectedResponse = Object.keys(expectedResponse).map((generatorId) => {
      return {
        energy_generator_id: parseInt(generatorId),
        energy: Object.entries(expectedResponse[generatorId].energy).map(
          ([date, amount]) => [date, amount]
        ),
      };
    });

    const response = await request(appInstance).get(
      `/retailer/generator?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      generators: expectedResponse,
    });
  });
});

describe('GET /retailer/suburbs', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

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
  });

  afterAll(async () => {
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return all suburbs', async () => {
    const response = await request(appInstance).get('/retailer/suburbs');

    expect(response.status).toBe(200);
    expect(response.body.suburbs.length).toBe(2);
    expect(response.body.suburbs).toEqual([
      expect.objectContaining({
        id: '1', // Use string for ID
        name: 'Test Suburb 1',
        postcode: 3000,
        state: 'Victoria',
        latitude: '100', // Use string for latitude
        longitude: '100', // Use string for longitude
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
      expect.objectContaining({
        id: '2', // Use string for ID
        name: 'Test Suburb 2',
        postcode: 3001,
        state: 'Victoria',
        latitude: '105', // Use string for latitude
        longitude: '100', // Use string for longitude
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    ]);
  });
});
