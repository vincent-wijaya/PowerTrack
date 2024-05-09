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
        energy: suburbConsumptionData.map((x: typeof SuburbConsumption) => {
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

describe('GET /retailer/map', () => {
  let sequelize: Sequelize;
  let appInstance: Application;
  const suburbTestData = [
    { id: 1, name: 'Test Suburb', postcode: 3000, state: 'Victoria', 'latitude': 100, 'longitude': 100 },
    { id: 2, name: 'Test Suburb 2', postcode: 3001, state: 'Victoria', 'latitude': 100, 'longitude': 100 },
  ];
  const consumerTestData = [
    { id: 1, street_address: '123 Test Street', high_priority: false, suburb_id: 1 },
    { id: 2, street_address: '456 Test Street', high_priority: false, suburb_id: 1 },
  ];
  const consumerConsumptionTestData = [
    { consumer_id: 1, date: new Date("2024-1-1T11:10:11"), amount: 1 },
    { consumer_id: 1, date: new Date("2024-1-1T13:10:11"), amount: 1 },
    { consumer_id: 1, date: new Date("2024-1-2T11:10:11"), amount: 1 },
    { consumer_id: 1, date: new Date("2024-1-2T13:10:11"), amount: 1 },
    { consumer_id: 1, date: new Date("2024-1-3T11:10:11"), amount: 1 },
  ];
  const suburbConsumptionTestData = [
    { suburb_id: 1, date: new Date("2024-1-1T10:10:11"), amount: 2 },
    { suburb_id: 1, date: new Date("2024-1-1T14:10:11"), amount: 2 },
    { suburb_id: 1, date: new Date("2024-1-2T10:10:11"), amount: 2 },
    { suburb_id: 1, date: new Date("2024-1-2T14:10:11"), amount: 2 },
    { suburb_id: 1, date: new Date("2024-1-3T10:10:11"), amount: 2 },
  ];
  const spotPriceTestData = [
    { date: new Date("2024-1-1T1:10:11"), amount: 3 }, // before all consumptions
    { date: new Date("2024-1-1T13:30:11"), amount: 3 }, // between second consumer and suburb consumptions
    { date: new Date("2024-1-2T12:10:11"), amount: 100 }, // after 3rd consumer and suburb consumptions This one shouldnt affect the price
    { date: new Date("2024-1-2T12:30:11"), amount: 3 }, // before last two of both consumer and suburb consumptions
    { date: new Date("2024-1-5T12:10:11"), amount: 3 }, // after all consumptions
  ];
  const sellingPriceTestData = [
    { date: new Date("2024-1-1T1:10:11"), amount: 4 }, // before all consumptions
    { date: new Date("2024-1-1T13:30:11"), amount: 4 }, // between second consumer and suburb consumptions
    { date: new Date("2024-1-2T12:10:11"), amount: 100 }, // after 3rd consumer and suburb consumptions This one shouldnt affect the price
    { date: new Date("2024-1-2T12:30:11"), amount: 4 }, // before last two of both consumer and suburb consumptions
    { date: new Date("2024-1-5T12:10:11"), amount: 4 }, // after all consumptions
  ];

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);
    const { Suburb, Consumer, SuburbConsumption, ConsumerConsumption, SpotPrice, SellingPrice } = await appInstance.get("models")
    // Insert prerequesite data for tests
    Suburb.bulkCreate(suburbTestData);
    Consumer.bulkCreate(consumerTestData);
    ConsumerConsumption.bulkCreate(consumerConsumptionTestData)
    SuburbConsumption.bulkCreate(suburbConsumptionTestData)
    SpotPrice.bulkCreate(spotPriceTestData)
    SellingPrice.bulkCreate(sellingPriceTestData)
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return no data', async () => {
    const response = await request(appInstance).get('/retailer/profit_margin');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ profit: [] });
  });
  it('should return data for all suburbs', async () => {

    const response = await request(appInstance).get('/retailer/map');

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);

    const expectedResults = []
    expect(response.body)
      .toEqual({
        profit: expectedResults
      }
      );
  });

  it('should return all data for the suburb', async () => {

  });
  it('should return data between dates for the suburb', async () => {

  });
  it('should return data after end date for the suburb', async () => {

  });
  it('should return all data for the consumer', async () => {

  });
  it('should return data between dates for the consumer', async () => {

  });
  it('should return data after the end date for the consumer', async () => {

  });
  it('should return error for wrong suburb', async () => {

  });
  it('should return error for wrong consumer', async () => {

  });

  // it('should return data for both suburbs', async () => {
  //   // Insert sample data into the database
  //   const SuburbConsumption = appInstance.get("models").SuburbConsumption;

  //   const suburbConsumptionData = await SuburbConsumption.bulkCreate([
  //     { suburb_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
  //     { suburb_id: 2, date: '2024-04-17T09:00:00Z', amount: 1100 },
  //   ]).catch((err: any) => console.log(err));

  //   const response = await request(appInstance).get('/retailer/map');

  //   console.log(`API response status: ${response.status}`);
  //   expect(response.status).toBe(200);
  //   console.log(`API response: ${JSON.stringify(response.body)}`);
  //   expect(response.body)
  //     .toEqual({
  //       energy: suburbConsumptionData.map((x: typeof SuburbConsumption) => 
  //         {
  //           return {
  //             suburb_id: x.suburb_id,
  //             consumption: x.amount,
  //             timestamp: x.date.toISOString(),
  //           }
  //         }),
  //     }
  //   );
  // });
});
