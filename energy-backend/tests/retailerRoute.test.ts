import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from "./testDb";


describe('GET /retailer/consumption', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Insert prerequesite data for tests
    await appInstance.get("models").Suburb.create({ id: 1, name: 'Test Suburb', postcode: 3000, state: 'Victoria', 'latitude': 0, 'longitude': 0 });
    await appInstance.get("models").SuburbConsumption.bulkCreate([
      { suburb_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
      { suburb_id: 1, date: '2024-04-17T09:05:00Z', amount: 1100 },
      { suburb_id: 1, date: '2024-04-17T09:10:00Z', amount: 1200 },
      { suburb_id: 1, date: '2024-04-17T09:15:00Z', amount: 1300 }
    ]);
    await appInstance.get("models").SellingPrice.create({ id: 1, date: '2024-04-01T09:00:00Z', amount: 0.25 });
    await appInstance.get("models").Consumer.create({ id: 1, street_address: '10 Test Street Melbourne Victoria 3000', high_priority: false, selling_price_id: 1, suburb_id: 1 });
    await appInstance.get("models").ConsumerConsumption.bulkCreate([
      { consumer_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
      { consumer_id: 1, date: '2024-04-17T09:05:00Z', amount: 1100 },
      { consumer_id: 1, date: '2024-04-17T09:10:00Z', amount: 1200 },
      { consumer_id: 1, date: '2024-04-17T09:15:00Z', amount: 1300 }
    ]);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return non-empty data for a suburb', async () => {
    // Insert sample data into the database
    const SuburbConsumption = appInstance.get("models").SuburbConsumption;
    
    const suburbConsumptionData = await SuburbConsumption.findAll(
      { where: { suburb_id: 1 } }
    );

    const response = await request(appInstance).get('/retailer/consumption?suburb_id=1&start_date=2024-04-17T09:05:00Z&end_date=2024-04-17T09:11:00Z');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect([
      suburbConsumptionData[1].toJSON(),
      suburbConsumptionData[2].toJSON(),
    ]).toEqual(response.body.energy.map((x: Object) => SuburbConsumption.build(x).toJSON()));
  });

  it('should return consumer data for all time', async () => {
    const SuburbConsumption = appInstance.get("models").SuburbConsumption;
    const suburbConsumptionData = await SuburbConsumption.findAll(
      { where: { suburb_id: 1 } }
    );

    const response = await request(appInstance).get('/retailer/consumption?suburb_id=1');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(suburbConsumptionData.map((x: typeof SuburbConsumption) => x.toJSON())).toEqual(
      response.body.energy.map((x: Object) => SuburbConsumption.build(x).toJSON())
    );
  });

  it('should return non-empty data for a consumer', async () => {
    // Insert sample data into the database
    const ConsumerConsumption = appInstance.get("models").ConsumerConsumption;
    const consumerConsumptionData = await ConsumerConsumption.findAll();

    const response = await request(appInstance).get('/retailer/consumption?consumer_id=1&start_date=2024-04-17T09:05:00Z&end_date=2024-04-17T09:11:00Z');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect([
      consumerConsumptionData[1].toJSON(),
      consumerConsumptionData[2].toJSON(),
    ]).toEqual(response.body.energy.map((x: Object) => ConsumerConsumption.build(x).toJSON()));
  });

  it('should return consumer data for all time', async () => {
    const ConsumerConsumption = appInstance.get("models").ConsumerConsumption;
    const consumerConsumptionData = await ConsumerConsumption.findAll();

    const response = await request(appInstance).get('/retailer/consumption?consumer_id=1');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(consumerConsumptionData.map((x: typeof ConsumerConsumption) => x.toJSON())).toEqual(
      response.body.energy.map((x: Object) => ConsumerConsumption.build(x).toJSON())
    );
  });

  it('should return data for nation-wide consumption', async () => {
    const response = await request(appInstance).get('/retailer/consumption?start_date=2024-04-17T09:05:00Z&end_date=2024-04-17T09:11:00Z');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(
      [
        {
          "suburb_id": "1",
          "start_date": "2024-04-17T09:05:00Z",
          "end_date": "2024-04-17T09:11:00Z",
          "amount": "2300",
        }
      ]
    ).toEqual(response.body.energy);
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
    await appInstance.get("models").Suburb.bulkCreate([
      { id: 1, name: 'Test Suburb', postcode: 3000, state: 'Victoria', 'latitude': 100, 'longitude': 100 },
      { id: 2, name: 'Test Suburb 2', postcode: 3001, state: 'Victoria', 'latitude': 105, 'longitude': 100 },
    ]);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return no data', async () => {
    const response = await request(appInstance).get('/retailer/map?lat1=90&long1=90&lat2=110&long2=110');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ energy: [] });
  });

  it('should return data for both suburbs', async () => {
    // Insert sample data into the database
    const SuburbConsumption = appInstance.get("models").SuburbConsumption;
    
    const suburbConsumptionData = await SuburbConsumption.bulkCreate([
      { suburb_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
      { suburb_id: 2, date: '2024-04-17T09:00:00Z', amount: 1100 },
    ]).catch((err: any) => console.log(err));

    const response = await request(appInstance).get('/retailer/map');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(response.body)
      .toEqual({
        energy: suburbConsumptionData.map((x: typeof SuburbConsumption) => 
          {
            return {
              suburb_id: x.suburb_id,
              consumption: x.amount,
              timestamp: x.date.toISOString(),
            }
          }),
      }
    );
  });
});
describe('GET /retailer/consumers', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    await appInstance.get("models").Suburb.bulkCreate([
      { id: 1, name: 'Test Suburb 1', postcode: 3000, state: 'Victoria', latitude: 100, longitude: 100 },
      { id: 2, name: 'Test Suburb 2', postcode: 3001, state: 'Victoria', latitude: 105, longitude: 100 }
    ]);

    await appInstance.get("models").Consumer.bulkCreate([
      { id: 1, street_address: '10 Test Street Melbourne Victoria 3000', high_priority: false, selling_price_id: 1, suburb_id: 1 },
      { id: 2, street_address: '20 Test Street Melbourne Victoria 3000', high_priority: true, selling_price_id: 1, suburb_id: 2 }
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
    const response = await request(appInstance).get('/retailer/consumers?suburb_id=1');

    expect(response.status).toBe(200);
    expect(response.body.consumers.length).toBe(1);
    expect(Number(response.body.consumers[0].suburb_id)).toBe(1); // Convert to number
  });

  it('should return a specific consumer by consumer_id', async () => {
    const response = await request(appInstance).get('/retailer/consumers?consumer_id=1');

    console.log('Response status:', response.status);
    console.log('Response body:', response.body);

    expect(response.status).toBe(200);
    expect(response.body.consumers.length).toBe(1);
    expect(response.body.consumers[0].id).toBe("1");
  });

  it('should return 400 if both suburb_id and consumer_id are specified', async () => {
    const response = await request(appInstance).get('/retailer/consumers?suburb_id=1&consumer_id=1');

    expect(response.status).toBe(400);
    expect(response.text).toBe("Cannot specify both suburb_id and consumer_id");
  });
});

describe('GET /retailer/suburbs', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    await appInstance.get("models").Suburb.bulkCreate([
      { id: 1, name: 'Test Suburb 1', postcode: 3000, state: 'Victoria', latitude: 100, longitude: 100 },
      { id: 2, name: 'Test Suburb 2', postcode: 3001, state: 'Victoria', latitude: 105, longitude: 100 }
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