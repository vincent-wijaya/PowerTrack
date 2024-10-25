// Set node enviornment to Test
process.env.NODE_ENV = 'test';

import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import { kWhConversionMultiplier } from '../utils/utils';
import { startOfDay, startOfHour, startOfISOWeek, subMinutes } from 'date-fns';

describe('GET /retailer/consumption', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const mockSuburbConsumptionData = [
    { suburb_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
    { suburb_id: 1, date: '2024-04-18T09:05:00Z', amount: 1100 },
    { suburb_id: 1, date: '2024-04-19T09:10:00Z', amount: 1200 },
    { suburb_id: 1, date: '2024-04-20T09:15:00Z', amount: 1300 },
    { suburb_id: 2, date: '2024-04-17T09:00:00Z', amount: 1400 },
    { suburb_id: 2, date: '2024-05-17T09:05:00Z', amount: 1500 },
    { suburb_id: 2, date: '2024-06-17T09:10:00Z', amount: 1600 },
    { suburb_id: 2, date: '2024-07-17T09:15:00Z', amount: 1700 },
  ];

  const mockConsumerConsumptionData = [
    { consumer_id: 1, date: '2024-04-17T09:00:00Z', amount: 1000 },
    { consumer_id: 1, date: '2024-04-18T09:05:00Z', amount: 1100 },
    { consumer_id: 1, date: '2024-04-19T09:10:00Z', amount: 1200 },
    { consumer_id: 1, date: '2024-04-20T09:15:00Z', amount: 1300 },
    { consumer_id: 2, date: '2024-04-17T09:00:00Z', amount: 1400 },
    { consumer_id: 2, date: '2024-05-17T09:05:00Z', amount: 1500 },
    { consumer_id: 2, date: '2024-06-17T09:10:00Z', amount: 1600 },
    { consumer_id: 2, date: '2024-07-17T09:15:00Z', amount: 1700 },
  ];

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
        latitude: 0,
        longitude: 0,
      },
      {
        id: 2,
        name: 'Test Suburb 2',
        postcode: 3001,
        state: 'Victoria',
        latitude: 0,
        longitude: 0,
      },
    ]);
    await appInstance
      .get('models')
      .SuburbConsumption.bulkCreate(mockSuburbConsumptionData);
    await appInstance.get('models').SellingPrice.create({
      id: 1,
      date: '2024-04-01T09:00:00.000Z',
      amount: 0.25,
    });
    await appInstance.get('models').Consumer.bulkCreate([
      {
        id: 1,
        street_address: '10 Test Street Melbourne Victoria 3000',
        latitude: 0,
        longitude: 0,
        high_priority: false,
        selling_price_id: 1,
        suburb_id: 1,
      },
      {
        id: 2,
        street_address: '11 Test Street Melbourne Victoria 3000',
        latitude: 0,
        longitude: 0,
        high_priority: false,
        selling_price_id: 1,
        suburb_id: 1,
      },
    ]);
    await appInstance
      .get('models')
      .ConsumerConsumption.bulkCreate(mockConsumerConsumptionData);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return error 400 if start_date is missing', async () => {
    const response = await request(appInstance).get('/retailer/consumption');

    expect(response.status).toBe(400);
  });

  it('should return error 400 if invalid start_date format is provided', async () => {
    const START_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/consumption?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if invalid end_date format is provided', async () => {
    const START_DATE = '2024-01-01T09:00:00.000Z';
    const END_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/consumption?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if future start date is provided', async () => {
    const START_DATE = '2099-01-01T09:00:00.000Z'; // Future date

    const response = await request(appInstance).get(
      `/retailer/consumption?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if both consumer_id and suburb_id are provided', async () => {
    const START_DATE = '2024-01-01T09:00:00.000Z';
    const CONSUMER_ID = 1;
    const SUBURB_ID = 1;

    const response = await request(appInstance).get(
      `/retailer/consumption?consumer_id=${CONSUMER_ID}&suburb_id=${SUBURB_ID}&start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return non-empty data for a suburb', async () => {
    // Insert sample data into the database
    const START_DATE = '2024-04-17T09:05:00.000Z';
    const END_DATE = '2024-04-17T09:11:00.000Z';
    const SUBURB_ID = 1;

    const adjustedSuburbConsumptionData = mockSuburbConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: startOfHour(consumption.date).toISOString(),
        };
      }
    );

    // Aggregate the data by hour
    let expectedEnergy = adjustedSuburbConsumptionData
      .filter(
        (consumption) =>
          new Date(START_DATE) < new Date(consumption.date) &&
          new Date(consumption.date) <= new Date(END_DATE) &&
          consumption.suburb_id === SUBURB_ID
      )
      .reduce((acc: any, consumption: any) => {
        if (!acc[consumption.truncatedDate]) {
          acc[consumption.truncatedDate] = {
            consumption: 0,
            count: 0,
          };
        }
        acc[consumption.truncatedDate].consumption += consumption.amount;
        acc[consumption.truncatedDate].count++;
        return acc;
      }, {});

    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount:
          (expectedEnergy[date].consumption / expectedEnergy[date].count) *
          kWhConversionMultiplier('hourly'), // Gets the average amount
      };
    });

    const response = await request(appInstance).get(
      `/retailer/consumption?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
    });
  });

  it('should return non-empty data for a consumer with weekly granularity', async () => {
    const START_DATE = '2024-03-17T09:05:00.000Z';
    const END_DATE = '2024-08-17T09:11:00.000Z';
    const CONSUMER_ID = 1;

    const adjustedConsumerConsumptionData = mockConsumerConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: startOfISOWeek(consumption.date).toISOString(),
        };
      }
    );

    let expectedEnergy = adjustedConsumerConsumptionData
      .filter(
        (consumption) =>
          consumption.date > START_DATE &&
          consumption.date <= END_DATE &&
          consumption.consumer_id === CONSUMER_ID
      )
      .reduce((acc: any, consumption: any) => {
        if (!acc[consumption.truncatedDate]) {
          acc[consumption.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[consumption.truncatedDate].amount += consumption.amount;
        acc[consumption.truncatedDate].count++;
        return acc;
      }, {});

    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount:
          (expectedEnergy[date].amount / expectedEnergy[date].count) *
          kWhConversionMultiplier('weekly'), // Gets the average amount
      };
    });

    const response = await request(appInstance).get(
      `/retailer/consumption?consumer_id=${CONSUMER_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(response.body).toEqual({
      consumer_id: CONSUMER_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
    });
  });

  it('should return non-empty data for a consumer with daily granularity', async () => {
    const START_DATE = '2024-04-13T09:05:00.000Z';
    const END_DATE = '2024-04-21T09:11:00.000Z';
    const CONSUMER_ID = 1;

    const adjustedConsumerConsumptionData = mockConsumerConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: startOfDay(consumption.date).toISOString(),
        };
      }
    );

    let expectedEnergy = adjustedConsumerConsumptionData
      .filter(
        (consumption) =>
          consumption.date > START_DATE &&
          consumption.date < END_DATE &&
          consumption.consumer_id === CONSUMER_ID
      )
      .reduce((acc: any, consumption: any) => {
        if (!acc[consumption.truncatedDate]) {
          acc[consumption.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[consumption.truncatedDate].amount += consumption.amount;
        acc[consumption.truncatedDate].count++;
        return acc;
      }, {});

    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount:
          (expectedEnergy[date].amount / expectedEnergy[date].count) *
          kWhConversionMultiplier('daily'), // Gets the average amount
      };
    });

    const response = await request(appInstance).get(
      `/retailer/consumption?consumer_id=${CONSUMER_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(response.body).toEqual({
      consumer_id: CONSUMER_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
    });
  });

  it('should return non-empty data for a consumer with hourly granularity', async () => {
    const START_DATE = '2024-04-17T09:05:00.000Z';
    const END_DATE = '2024-04-17T09:11:00.000Z';
    const CONSUMER_ID = 1;

    const adjustedConsumerConsumptionData = mockConsumerConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: startOfHour(consumption.date).toISOString(),
        };
      }
    );

    let expectedEnergy = adjustedConsumerConsumptionData
      .filter(
        (consumption) =>
          consumption.date > START_DATE &&
          consumption.date < END_DATE &&
          consumption.consumer_id === CONSUMER_ID
      )
      .reduce((acc: any, consumption: any) => {
        if (!acc[consumption.truncatedDate]) {
          acc[consumption.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[consumption.truncatedDate].amount += consumption.amount;
        acc[consumption.truncatedDate].count++;
        return acc;
      }, {});

    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount:
          (expectedEnergy[date].amount / expectedEnergy[date].count) *
          kWhConversionMultiplier('hourly'), // Gets the average amount
      };
    });

    const response = await request(appInstance).get(
      `/retailer/consumption?consumer_id=${CONSUMER_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(response.body).toEqual({
      consumer_id: CONSUMER_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
    });
  });

  it('should return data for nation-wide consumption', async () => {
    const START_DATE = '2024-04-17T09:05:00.000Z';
    const END_DATE = '2024-04-17T09:11:00.000Z';

    const adjustedSuburbConsumptionData = mockSuburbConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: startOfHour(consumption.date).toISOString(),
        };
      }
    );

    let expectedEnergy = adjustedSuburbConsumptionData
      .filter(
        (consumption) =>
          consumption.date > START_DATE && consumption.date < END_DATE
      )
      .reduce((acc: any, consumption: any) => {
        if (!acc[consumption.truncatedDate]) {
          acc[consumption.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[consumption.truncatedDate].amount += consumption.amount;
        acc[consumption.truncatedDate].count++;
        return acc;
      }, {});

    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount:
          (expectedEnergy[date].amount / expectedEnergy[date].count) *
          kWhConversionMultiplier('hourly'), // Gets the average amount
      };
    });

    const response = await request(appInstance).get(
      `/retailer/consumption?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    console.log(`API response status: ${response.status}`);
    expect(response.status).toBe(200);
    console.log(`API response: ${JSON.stringify(response.body)}`);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
    });
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

describe('GET /retailer/powerOutages', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const mockConsumerData = [
    {
      id: 1,
      street_address: '21 Irwin Street, Clayton, Victoria 3168',
      latitude: '-37.91743928495542',
      longitude: '145.13327012656347',
      high_priority: false,
      suburb_id: 1,
    },
    {
      id: 2,
      street_address: '2033 Dandenong Road, Clayton, Victoria 3168',
      latitude: '-37.91810996899869',
      longitude: '145.1340092264933',
      high_priority: true,
      suburb_id: 1,
    },
    {
      id: 3,
      street_address: '54 Hemmings Street, Dandenong, Victoria 3175',
      latitude: '-37.98274741773752',
      longitude: '145.20415884009546',
      high_priority: false,
      suburb_id: 2,
    },
    {
      id: 4,
      street_address: '2 Fifth Avenue, Dandenong, Victoria 3175',
      latitude: '-37.98242712987717',
      longitude: '145.2044102971904',
      high_priority: true,
      suburb_id: 2,
    },
    {
      id: 5,
      street_address: '16 Wilma Ave, Dandenong, Victoria 3175',
      latitude: '-37.9821167497358',
      longitude: '145.20261601981665',
      high_priority: false,
      suburb_id: 2,
    },
    {
      id: 6,
      street_address: 'Somewhere far',
      latitude: '0', // outside of a cluster
      longitude: '0',
      high_priority: true, // high priority
      suburb_id: 2,
    },
    {
      id: 7,
      street_address: 'Somewhere far other place',
      latitude: '10', // outside of a cluster
      longitude: '10',
      high_priority: false, // high priority
      suburb_id: 2,
    },
  ];

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    const { Suburb, Consumer } = appInstance.get('models');

    // Insert prerequesite data for tests
    await Suburb.bulkCreate([
      {
        id: 1,
        name: 'Clayton',
        postcode: 3168,
        state: 'Victoria',
        latitude: -37.915047,
        longitude: 145.129272,
      },
      {
        id: 2,
        name: 'Dandenong',
        postcode: 3175,
        state: 'Victoria',
        latitude: -37.8253,
        longitude: 145.356,
      },
    ]);

    await Consumer.bulkCreate(mockConsumerData);
  });

  afterEach(async () => {
    // Clear the ConsumerConsumption table
    await appInstance.get('models').ConsumerConsumption.destroy({
      where: {},
      truncate: true,
    });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return empty data if no consumers have logged any data', async () => {
    const response = await request(appInstance).get('/retailer/powerOutages');

    const expectedResponse = {
      power_outages: {
        consumers: [],
        clusters: [],
      },
    };

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expectedResponse);
  });

  it('should return non-empty data of the only houses that have logged data and are having power outage', async () => {
    const { ConsumerConsumption } = appInstance.get('models');

    // Insert prerequesite data for tests
    const mockConsumptionData = [
      {
        consumer_id: 1,
        date: subMinutes(new Date(), 34).toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 10,
      },
      {
        consumer_id: 2, // high priority
        date: subMinutes(new Date(), 34).toISOString(), // last log was >5 minutes ago ==> power outage
        amount: 5,
      },
    ];

    await ConsumerConsumption.bulkCreate(mockConsumptionData);

    const response = await request(appInstance).get('/retailer/powerOutages');

    const expectedResponse = {
      power_outages: {
        consumers: [
          {
            id: 1,
            street_address: mockConsumerData[0].street_address,
            suburb_id: Number(mockConsumerData[0].suburb_id),
            latitude: Number(mockConsumerData[0].latitude),
            longitude: Number(mockConsumerData[0].longitude),
            high_priority: mockConsumerData[0].high_priority,
          },
          {
            id: 2,
            street_address: mockConsumerData[1].street_address,
            suburb_id: Number(mockConsumerData[1].suburb_id),
            latitude: Number(mockConsumerData[1].latitude),
            longitude: Number(mockConsumerData[1].longitude),
            high_priority: mockConsumerData[1].high_priority,
          },
        ],
        clusters: [
          {
            consumers: [
              {
                id: 1,
                street_address: mockConsumerData[0].street_address,
                suburb_id: Number(mockConsumerData[0].suburb_id),
                latitude: Number(mockConsumerData[0].latitude),
                longitude: Number(mockConsumerData[0].longitude),
                high_priority: mockConsumerData[0].high_priority,
              },
              {
                id: 2,
                street_address: mockConsumerData[1].street_address,
                suburb_id: Number(mockConsumerData[1].suburb_id),
                latitude: Number(mockConsumerData[1].latitude),
                longitude: Number(mockConsumerData[1].longitude),
                high_priority: mockConsumerData[1].high_priority,
              },
            ],
          },
        ],
      },
    };

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expectedResponse);
  });

  it('should return empty data if there are no power outages', async () => {
    const { ConsumerConsumption } = appInstance.get('models');

    // Insert prerequesite data for tests
    const mockConsumptionData = [
      {
        consumer_id: 1,
        date: subMinutes(new Date(), 4).toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 10,
      },
      {
        consumer_id: 2, // high priority
        date: subMinutes(new Date(), 4).toISOString(), // last log was <5 minutes ago ==> no power outage
        amount: 5,
      },
      {
        consumer_id: 3,
        date: subMinutes(new Date(), 4).toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 10,
      },
      {
        consumer_id: 4, // high priority
        date: subMinutes(new Date(), 4).toISOString(), // last log was <5 minutes ago ==> no power outage
        amount: 4,
      },
      {
        consumer_id: 5,
        date: subMinutes(new Date(), 4).toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 6,
      },
      {
        consumer_id: 6,
        date: subMinutes(new Date(), 4).toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 6,
      },
      {
        consumer_id: 7,
        date: subMinutes(new Date(), 4).toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 6,
      },
      {
        consumer_id: 1,
        date: subMinutes(new Date(), 2).toISOString(),
        amount: 0, // no energy consumed in last 30 minutes ==> power outage
      },
    ];

    await ConsumerConsumption.bulkCreate(mockConsumptionData);

    const response = await request(appInstance).get('/retailer/powerOutages');

    const expectedResponse = {
      power_outages: {
        consumers: [],
        clusters: [],
      },
    };

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expectedResponse);
  });

  it('should return non-empty data of all power outages', async () => {
    const { ConsumerConsumption } = appInstance.get('models');

    // Insert prerequesite data for tests
    const mockConsumptionData = [
      {
        consumer_id: 1,
        date: subMinutes(new Date(), 36).toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 10,
      },
      {
        consumer_id: 2, // high priority
        date: subMinutes(new Date(), 40).toISOString(), // last log was >5 minutes ago ==> power outage
        amount: 5,
      },
      {
        consumer_id: 3,
        date: subMinutes(new Date(), 48).toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 10,
      },
      {
        consumer_id: 4, // high priority
        date: subMinutes(new Date(), 2).toISOString(), // last log was <5 minutes ago ==> no power outage
        amount: 4,
      },
      {
        consumer_id: 5,
        date: subMinutes(new Date(), 58).toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 6,
      },
      // No data for consumer_id = 6 and is high priority => power outage

      {
        consumer_id: 6,
        date: subMinutes(new Date(), 58).toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 6,
      },
      // No data for consumer_id = 7 but is not high priority and not in a cluster => no power outage
    ];

    await ConsumerConsumption.bulkCreate(mockConsumptionData);

    const response = await request(appInstance).get('/retailer/powerOutages');

    const expectedResponse = {
      power_outages: {
        consumers: [
          {
            id: 1,
            street_address: mockConsumerData[0].street_address,
            suburb_id: Number(mockConsumerData[0].suburb_id),
            latitude: Number(mockConsumerData[0].latitude),
            longitude: Number(mockConsumerData[0].longitude),
            high_priority: mockConsumerData[0].high_priority,
          },
          {
            id: 2,
            street_address: mockConsumerData[1].street_address,
            suburb_id: Number(mockConsumerData[1].suburb_id),
            latitude: Number(mockConsumerData[1].latitude),
            longitude: Number(mockConsumerData[1].longitude),
            high_priority: mockConsumerData[1].high_priority,
          },
          {
            id: 3,
            street_address: mockConsumerData[2].street_address,
            suburb_id: Number(mockConsumerData[2].suburb_id),
            latitude: Number(mockConsumerData[2].latitude),
            longitude: Number(mockConsumerData[2].longitude),
            high_priority: mockConsumerData[2].high_priority,
          },
          {
            id: 5,
            street_address: mockConsumerData[4].street_address,
            suburb_id: Number(mockConsumerData[4].suburb_id),
            latitude: Number(mockConsumerData[4].latitude),
            longitude: Number(mockConsumerData[4].longitude),
            high_priority: mockConsumerData[4].high_priority,
          },
          {
            id: 6,
            street_address: mockConsumerData[5].street_address,
            suburb_id: Number(mockConsumerData[5].suburb_id),
            latitude: Number(mockConsumerData[5].latitude),
            longitude: Number(mockConsumerData[5].longitude),
            high_priority: mockConsumerData[5].high_priority,
          },
        ],
        clusters: [
          {
            consumers: [
              {
                id: 1,
                street_address: mockConsumerData[0].street_address,
                suburb_id: Number(mockConsumerData[0].suburb_id),
                latitude: Number(mockConsumerData[0].latitude),
                longitude: Number(mockConsumerData[0].longitude),
                high_priority: mockConsumerData[0].high_priority,
              },
              {
                id: 2,
                street_address: mockConsumerData[1].street_address,
                suburb_id: Number(mockConsumerData[1].suburb_id),
                latitude: Number(mockConsumerData[1].latitude),
                longitude: Number(mockConsumerData[1].longitude),
                high_priority: mockConsumerData[1].high_priority,
              },
            ],
          },
          {
            consumers: [
              {
                id: 3,
                street_address: mockConsumerData[2].street_address,
                suburb_id: Number(mockConsumerData[2].suburb_id),
                latitude: Number(mockConsumerData[2].latitude),
                longitude: Number(mockConsumerData[2].longitude),
                high_priority: mockConsumerData[2].high_priority,
              },
              {
                id: 5,
                street_address: mockConsumerData[4].street_address,
                suburb_id: Number(mockConsumerData[3].suburb_id),
                latitude: Number(mockConsumerData[4].latitude),
                longitude: Number(mockConsumerData[4].longitude),
                high_priority: mockConsumerData[4].high_priority,
              },
            ],
          },
          {
            consumers: [
              {
                id: 6,
                street_address: mockConsumerData[5].street_address,
                suburb_id: Number(mockConsumerData[5].suburb_id),
                latitude: Number(mockConsumerData[5].latitude),
                longitude: Number(mockConsumerData[5].longitude),
                high_priority: mockConsumerData[5].high_priority,
              },
            ],
          },
        ],
      },
    };

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expectedResponse);
  });
});
