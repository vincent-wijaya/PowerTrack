// Set node enviornment to Test
process.env.NODE_ENV = 'test';

import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import moment from 'moment';
import { exportsForTesting } from '../routes/retailerRoute';
const { splitEvents } = exportsForTesting;
import { kWhConversionMultiplier } from '../utils/utils';
import { addYears, differenceInHours, startOfHour } from 'date-fns';

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
      date: '2024-04-01T09:00:00Z',
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
    const START_DATE = '2024-01-01T09:00:00Z';
    const END_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/consumption?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if future start date is provided', async () => {
    const START_DATE = '2099-01-01T09:00:00Z'; // Future date

    const response = await request(appInstance).get(
      `/retailer/consumption?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if both consumer_id and suburb_id are provided', async () => {
    const START_DATE = '2024-01-01T09:00:00Z';
    const CONSUMER_ID = 1;
    const SUBURB_ID = 1;

    const response = await request(appInstance).get(
      `/retailer/consumption?consumer_id=${CONSUMER_ID}&suburb_id=${SUBURB_ID}&start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return non-empty data for a suburb', async () => {
    // Insert sample data into the database
    const START_DATE = '2024-04-17T09:05:00Z';
    const END_DATE = '2024-04-17T09:11:00Z';
    const SUBURB_ID = 1;

    const adjustedSuburbConsumptionData = mockSuburbConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: moment(consumption.date).startOf('hour').toISOString(),
        };
      }
    );

    // Aggregate the data by hour
    let expectedEnergy = adjustedSuburbConsumptionData
      .filter(
        (consumption) =>
          moment(START_DATE) < moment(consumption.date) &&
          moment(consumption.date) <= moment(END_DATE) &&
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
    const START_DATE = '2024-03-17T09:05:00Z';
    const END_DATE = '2024-08-17T09:11:00Z';
    const CONSUMER_ID = 1;

    const adjustedConsumerConsumptionData = mockConsumerConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: moment(consumption.date)
            .startOf('isoWeek')
            .toISOString(),
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
    const START_DATE = '2024-04-13T09:05:00Z';
    const END_DATE = '2024-04-21T09:11:00Z';
    const CONSUMER_ID = 1;

    const adjustedConsumerConsumptionData = mockConsumerConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: moment(consumption.date).startOf('day').toISOString(),
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
    const START_DATE = '2024-04-17T09:05:00Z';
    const END_DATE = '2024-04-17T09:11:00Z';
    const CONSUMER_ID = 1;

    const adjustedConsumerConsumptionData = mockConsumerConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: moment(consumption.date).startOf('hour').toISOString(),
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
    const START_DATE = '2024-04-17T09:05:00Z';
    const END_DATE = '2024-04-17T09:11:00Z';

    const adjustedSuburbConsumptionData = mockSuburbConsumptionData.map(
      (consumption) => {
        return {
          ...consumption,
          truncatedDate: moment(consumption.date).startOf('hour').toISOString(),
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

describe('GET /retailer/generation', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const mockGenerationData = [
    { energy_generator_id: 1, date: '2024-01-01T09:00:00Z', amount: 100 },
    { energy_generator_id: 1, date: '2024-01-01T09:30:00Z', amount: 200 },
    { energy_generator_id: 1, date: '2024-02-01T09:00:00Z', amount: 200 },
    { energy_generator_id: 1, date: '2024-02-01T09:30:00Z', amount: 300 },
    { energy_generator_id: 1, date: '2024-03-01T09:00:00Z', amount: 300 },
    { energy_generator_id: 1, date: '2024-03-01T09:30:00Z', amount: 400 },
    { energy_generator_id: 1, date: '2024-04-01T09:00:00Z', amount: 400 },
    { energy_generator_id: 1, date: '2024-04-01T09:30:00Z', amount: 500 },

    { energy_generator_id: 1, date: '2024-06-01T09:00:00Z', amount: 500 },
    { energy_generator_id: 1, date: '2024-06-01T12:00:00Z', amount: 800 },
    { energy_generator_id: 1, date: '2024-06-02T10:00:00Z', amount: 500 },
    { energy_generator_id: 1, date: '2024-06-02T12:00:00Z', amount: 800 },
    { energy_generator_id: 1, date: '2024-06-03T11:00:00Z', amount: 500 },
    { energy_generator_id: 1, date: '2024-06-03T12:00:00Z', amount: 800 },

    { energy_generator_id: 2, date: '2024-01-01T09:00:00Z', amount: 100 },
    { energy_generator_id: 2, date: '2024-01-02T09:00:00Z', amount: 300 },
    { energy_generator_id: 2, date: '2024-02-01T09:00:00Z', amount: 200 },
    { energy_generator_id: 2, date: '2024-02-02T09:00:00Z', amount: 400 },
    { energy_generator_id: 2, date: '2024-03-01T09:00:00Z', amount: 300 },
    { energy_generator_id: 2, date: '2024-03-02T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-04-01T09:00:00Z', amount: 400 },
    { energy_generator_id: 2, date: '2024-04-02T09:00:00Z', amount: 600 },

    { energy_generator_id: 2, date: '2024-06-01T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-06-01T09:30:00Z', amount: 1000 },
    { energy_generator_id: 2, date: '2024-06-02T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-06-02T09:30:00Z', amount: 1000 },
    { energy_generator_id: 2, date: '2024-06-03T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-06-03T09:30:00Z', amount: 1000 },
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

    await GeneratorType.create({
      id: 1,
      category: 'Test Generator',
      renewable: false,
    });
    await EnergyGenerator.bulkCreate([
      { id: 1, name: 'Test Generator', suburb_id: 1, generator_type_id: 1 },
      { id: 2, name: 'Test Generator 2', suburb_id: 2, generator_type_id: 1 },
    ]);
    await EnergyGeneration.bulkCreate(mockGenerationData);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return error 400 if invalid suburb_id is provided', async () => {
    const SUBURB_ID = '1.111'; // Invalid suburb_id

    const response = await request(appInstance).get(
      `/retailer/generation?suburb_id=${SUBURB_ID}`
    );

    expect(response.status).toBe(400);
  });

  it('should return empty generation if invalid suburb_id is provided', async () => {
    const SUBURB_ID = 10000; // Invalid suburb_id
    const START_DATE = '2023-06-01T09:00:00Z';
    const END_DATE = '2023-06-03T12:00:00Z';

    const response = await request(appInstance).get(
      `/retailer/generation?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      energy: [],
    });
  });

  it('should return error 400 if start date is missing', async () => {
    const response = await request(appInstance).get('/retailer/generation');

    expect(response.status).toBe(400);
  });

  it('should return error 400 if invalid start date format is provided', async () => {
    const START_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/generation?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if invalid end date format is provided', async () => {
    const START_DATE = '2024-01-01T09:00:00Z';
    const END_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/generation?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if future start date is provided', async () => {
    const START_DATE = '2099-01-01T09:00:00Z'; // Future date

    const response = await request(appInstance).get(
      `/retailer/generation?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return with status and the generation with hourly granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2023-06-01T08:00:00Z';
    const END_DATE = '2023-06-03T12:00:00Z';

    const adjustedGenerationData = mockGenerationData.map((generation) => {
      return {
        ...generation,
        truncatedDate: moment(generation.date).startOf('hour').toISOString(),
      };
    });

    // Aggregate the data by week
    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          moment(START_DATE) < moment(generation.date) &&
          moment(generation.date) <= moment(END_DATE) &&
          generation.energy_generator_id === SUBURB_ID
      )
      .reduce((acc: any, generation: any) => {
        if (!acc[generation.truncatedDate]) {
          acc[generation.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[generation.truncatedDate].amount += generation.amount;
        acc[generation.truncatedDate].count++;
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
      `/retailer/generation?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
    });
  });

  it('should respond with status 200 and generation between 1 Jan 2024 and 7 Jan 2024 with daily granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2023-06-01T08:00:00Z';
    const END_DATE = '2023-06-08T08:00:00Z';

    const adjustedGenerationData = mockGenerationData.map((generation) => {
      return {
        ...generation,
        truncatedDate: moment(generation.date).startOf('day').toISOString(),
      };
    });

    // Aggregate the data by week
    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          moment(START_DATE) < moment(generation.date) &&
          moment(generation.date) <= moment(END_DATE) &&
          generation.energy_generator_id === SUBURB_ID
      )
      .reduce((acc: any, generation: any) => {
        if (!acc[generation.truncatedDate]) {
          acc[generation.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[generation.truncatedDate].amount += generation.amount;
        acc[generation.truncatedDate].count++;
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
      `/retailer/generation?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
    });
  });

  it('should respond with status 200 and generation between January 2023 and August 2023 with weekly granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2023-01-01T08:00:00Z';
    const END_DATE = '2023-08-01T08:00:00Z';

    const adjustedGenerationData = mockGenerationData.map((generation) => {
      return {
        ...generation,
        truncatedDate: moment(generation.date).startOf('isoWeek').toISOString(),
      };
    });

    // Aggregate the data by week and averaging the amount
    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          moment(generation.date) > moment(START_DATE) &&
          moment(generation.date) <= moment(END_DATE) &&
          generation.energy_generator_id === SUBURB_ID
      )
      .reduce((acc: any, generation: any) => {
        if (!acc[generation.truncatedDate]) {
          acc[generation.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[generation.truncatedDate].amount += generation.amount;
        acc[generation.truncatedDate].count++;
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
      `/retailer/generation?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
    });
  });

  it('should return nationwide average with weekly granularity', async () => {
    const START_DATE = '2023-01-01T08:00:00Z';
    const END_DATE = '2023-08-01T08:00:00Z';

    const adjustedGenerationData = mockGenerationData.map((generation) => {
      return {
        ...generation,
        truncatedDate: moment(generation.date).startOf('isoWeek').toISOString(),
      };
    });

    // Aggregate the data by week
    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          moment(START_DATE) < moment(generation.date) &&
          moment(generation.date) <= moment(END_DATE)
      )
      .reduce((acc: any, generation: any) => {
        if (!acc[generation.truncatedDate]) {
          acc[generation.truncatedDate] = {
            amount: 0,
            count: 0,
          };
        }
        acc[generation.truncatedDate].amount += generation.amount;
        acc[generation.truncatedDate].count++;
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
      `/retailer/generation?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      energy: expectedEnergy,
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
        truncatedDate: moment(sellingPrice.date)
          .startOf('isoWeek')
          .toISOString(),
      };
    });

    const adjustedSpotPrices = spotPriceTestData.map((spotPrice) => {
      return {
        ...spotPrice,
        truncatedDate: moment(spotPrice.date).startOf('isoWeek').toISOString(),
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
        date: moment().subtract(3, 'minutes'), // < 5 minutes => no power outage
        amount: 10,
      },
      {
        consumer_id: 2,
        date: moment().subtract(6, 'minutes'), // > 5 minutes => power outage
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

describe('GET /retailer/sources', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const mockEnergyGenerationData = [
    { energy_generator_id: 0, date: '2024-01-01T09:00:00Z', amount: 100 },
    { energy_generator_id: 1, date: '2024-01-01T09:00:00Z', amount: 200 },
    { energy_generator_id: 2, date: '2024-01-01T09:00:00Z', amount: 300 },
    { energy_generator_id: 3, date: '2024-01-01T09:00:00Z', amount: 300 },
  ];

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    const {
      Suburb,
      Consumer,
      GeneratorType,
      EnergyGenerator,
      EnergyGeneration,
    } = appInstance.get('models');

    await Suburb.bulkCreate([
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

    await Consumer.bulkCreate([
      {
        id: 1,
        street_address: '21 Irwin Street, Clayton, Victoria 3168',
        latitude: -37.91743928495542,
        longitude: 145.13327012656347,
        high_priority: false,
        suburb_id: 1,
      },
      {
        id: 2,
        street_address: '2033 Dandenong Road, Clayton, Victoria 3168',
        latitude: -37.91810996899869,
        longitude: 145.1340092264933,
        high_priority: true,
        suburb_id: 1,
      },
      {
        id: 3,
        street_address: '54 Hemmings Street, Dandenong, Victoria 3175',
        latitude: -37.98274741773752,
        longitude: 145.20415884009546,
        high_priority: false,
        suburb_id: 2,
      },
    ]);

    await GeneratorType.bulkCreate([
      {
        id: 1,
        category: 'Natural Gas Pipeline',
        renewable: false,
      },
      {
        id: 2,
        category: 'Solar',
        renewable: true,
      },
      {
        id: 3,
        category: 'Wind',
        renewable: true,
      },
    ]);

    await EnergyGenerator.bulkCreate([
      {
        id: 0,
        name: '990 Latrobe St',
        suburb_id: 1,
        generator_type_id: 1,
      },
      {
        id: 1,
        name: 'Aeroten Leongatha Solar',
        suburb_id: 1,
        generator_type_id: 2,
      },
      {
        id: 2,
        name: 'Ararat Wind Farm',
        suburb_id: 2,
        generator_type_id: 3,
      },
      {
        id: 3,
        name: 'Ararat Wind Farm 2',
        suburb_id: 2,
        generator_type_id: 3,
      },
    ]);

    await EnergyGeneration.bulkCreate(mockEnergyGenerationData);
  });

  afterAll(async () => {
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return error 400 if start date is missing', async () => {
    const response = await request(appInstance).get('/retailer/sources');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Start date must be provided.',
    });
  });

  it('should return error 400 if invalid start date format is provided', async () => {
    const START_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/sources?start_date=${START_DATE}`
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
      `/retailer/sources?start_date=${START_DATE}&end_date=${END_DATE}`
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
      `/retailer/sources?start_date=${START_DATE}&end_date=${END_DATE}`
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
      `/retailer/sources?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'End date must not be in the future.',
    });
  });

  it('should return error 400 if both consumer_id and suburb_id are provided', async () => {
    const response = await request(appInstance).get(
      '/retailer/sources?start_date=2024-01-01T08:00:00.000Z&consumer_id=1&suburb_id=1'
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Cannot specify both suburb_id and consumer_id.',
    });
  });

  it('should return empty data of energy sources for empty suburb', async () => {
    const START_DATE = '2024-01-01T08:00:00.000Z';

    const response = await request(appInstance).get(
      `/retailer/sources?start_date=${START_DATE}&suburb_id=999`
    );

    expect(response.status).toBe(200);
    expect(response.body.sources).toEqual([]);
  });

  it("should return non-empty data of a consumer's suburb's energy sources", async () => {
    const START_DATE = '2024-01-01T08:00:00.000Z';
    const END_DATE = '2024-01-01T11:00:00.000Z';
    const CONSUMER_ID = 3;

    const response = await request(appInstance).get(
      `/retailer/sources?start_date=${START_DATE}&end_date=${END_DATE}&consumer_id=${CONSUMER_ID}`
    );

    // Get the number of hours in the period to convert kW to kWh
    const hoursInPeriod = differenceInHours(
      new Date(END_DATE),
      new Date(START_DATE)
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      consumer_id: CONSUMER_ID,
      sources: [
        {
          category: 'Wind',
          renewable: true,
          percentage: 1,
          amount:
            (mockEnergyGenerationData[2].amount +
              mockEnergyGenerationData[3].amount) *
            hoursInPeriod,
        },
      ],
    });
  });

  it("should return non-empty data of a suburb's energy sources", async () => {
    const START_DATE = '2024-01-01T08:00:00.000Z';
    const END_DATE = '2024-01-01T11:00:00.000Z';
    const SUBURB_ID = 2;

    const response = await request(appInstance).get(
      `/retailer/sources?start_date=${START_DATE}&end_date=${END_DATE}&suburb_id=${SUBURB_ID}`
    );

    // Get the number of hours in the period to convert kW to kWh
    const hoursInPeriod = differenceInHours(
      new Date(END_DATE),
      new Date(START_DATE)
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      suburb_id: SUBURB_ID,
      sources: [
        {
          category: 'Wind',
          renewable: true,
          percentage: 1,
          amount:
            (mockEnergyGenerationData[2].amount +
              mockEnergyGenerationData[3].amount) *
            hoursInPeriod,
        },
      ],
    });
  });

  it('should return non-empty data of nation-wide energy sources', async () => {
    const START_DATE = '2024-01-01T08:00:00.000Z';
    const END_DATE = '2024-01-01T11:00:00.000Z';

    const totalGeneration = mockEnergyGenerationData.reduce((acc, source) => {
      acc += source.amount;

      return acc;
    }, 0);

    const response = await request(appInstance).get(
      `/retailer/sources?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    // Get the number of hours in the period to convert kW to kWh
    const hoursInPeriod = differenceInHours(
      new Date(END_DATE),
      new Date(START_DATE)
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      sources: [
        expect.objectContaining({
          category: 'Natural Gas Pipeline',
          renewable: false,
          percentage: mockEnergyGenerationData[0].amount / totalGeneration,
          amount: mockEnergyGenerationData[0].amount * hoursInPeriod,
        }),
        expect.objectContaining({
          category: 'Solar',
          renewable: true,
          percentage: mockEnergyGenerationData[1].amount / totalGeneration,
          amount: mockEnergyGenerationData[1].amount * hoursInPeriod,
        }),
        expect.objectContaining({
          category: 'Wind',
          renewable: true,
          percentage:
            (mockEnergyGenerationData[2].amount +
              mockEnergyGenerationData[3].amount) /
            totalGeneration,
          amount:
            (mockEnergyGenerationData[2].amount +
              mockEnergyGenerationData[3].amount) *
            hoursInPeriod,
        }),
      ],
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
        latitude: 100,
        longitude: 100,
        high_priority: false,
        selling_price_id: 1,
        suburb_id: 1,
      },
      {
        id: 2,
        street_address: '20 Test Street Melbourne Victoria 3000',
        latitude: 100,
        longitude: 100,
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
    { energy_generator_id: 1, date: '2024-01-01T09:30:00Z', amount: 200 },
    { energy_generator_id: 1, date: '2024-02-01T09:00:00Z', amount: 200 },
    { energy_generator_id: 1, date: '2024-02-01T09:30:00Z', amount: 300 },
    { energy_generator_id: 1, date: '2024-03-01T09:00:00Z', amount: 300 },
    { energy_generator_id: 1, date: '2024-03-01T09:30:00Z', amount: 400 },
    { energy_generator_id: 1, date: '2024-04-01T09:00:00Z', amount: 400 },
    { energy_generator_id: 1, date: '2024-04-01T09:30:00Z', amount: 500 },

    { energy_generator_id: 1, date: '2024-06-01T09:00:00Z', amount: 500 },
    { energy_generator_id: 1, date: '2024-06-01T12:00:00Z', amount: 800 },
    { energy_generator_id: 1, date: '2024-06-02T10:00:00Z', amount: 500 },
    { energy_generator_id: 1, date: '2024-06-02T12:00:00Z', amount: 800 },
    { energy_generator_id: 1, date: '2024-06-03T11:00:00Z', amount: 500 },
    { energy_generator_id: 1, date: '2024-06-03T12:00:00Z', amount: 800 },

    { energy_generator_id: 2, date: '2024-01-01T09:00:00Z', amount: 100 },
    { energy_generator_id: 2, date: '2024-01-02T09:00:00Z', amount: 300 },
    { energy_generator_id: 2, date: '2024-02-01T09:00:00Z', amount: 200 },
    { energy_generator_id: 2, date: '2024-02-02T09:00:00Z', amount: 400 },
    { energy_generator_id: 2, date: '2024-03-01T09:00:00Z', amount: 300 },
    { energy_generator_id: 2, date: '2024-03-02T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-04-01T09:00:00Z', amount: 400 },
    { energy_generator_id: 2, date: '2024-04-02T09:00:00Z', amount: 600 },

    { energy_generator_id: 2, date: '2024-06-01T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-06-01T09:30:00Z', amount: 1000 },
    { energy_generator_id: 2, date: '2024-06-02T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-06-02T09:30:00Z', amount: 1000 },
    { energy_generator_id: 2, date: '2024-06-03T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-06-03T09:30:00Z', amount: 1000 },
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

  it('should return empty generator array if invalid suburb_id is provided', async () => {
    const SUBURB_ID = 100000; // Suburb doesn't exist
    const START_DATE = '2024-06-01T09:00:00Z';
    const END_DATE = '2024-06-03T11:00:00Z';

    const response = await request(appInstance).get(
      `/retailer/generator?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      generators: [],
    });
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

    const adjustedGenerationData = mockEnergyGenerations.map((generation) => {
      return {
        ...generation,
        truncatedDate: moment(generation.date).startOf('isoWeek').toISOString(),
      };
    });

    let expectedEnergy = adjustedGenerationData
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

        // Set initial value to 0 if it doesn't exist yet
        if (
          !acc[generation.energy_generator_id].energy[generation.truncatedDate]
        ) {
          acc[generation.energy_generator_id].energy[generation.truncatedDate] =
            {
              amount: 0,
              count: 0,
            };
        }

        // Add the amount to the existing value
        acc[generation.energy_generator_id].energy[
          generation.truncatedDate
        ].amount += generation.amount;
        acc[generation.energy_generator_id].energy[generation.truncatedDate]
          .count++;

        return acc;
      }, {});

    expectedEnergy = Object.keys(expectedEnergy).map((generatorId) => {
      return {
        energy_generator_id: parseInt(generatorId),
        energy: Object.keys(expectedEnergy[generatorId].energy).map((date) => {
          return {
            date,
            amount:
              (expectedEnergy[generatorId].energy[date].amount /
                expectedEnergy[generatorId].energy[date].count) *
              kWhConversionMultiplier('weekly'),
          };
        }),
      };
    });

    const response = await request(appInstance).get(
      `/retailer/generator?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      generators: expectedEnergy,
    });
  });

  it('should return average energy generation of each generator in suburb in daily time granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2024-05-30T09:00:00Z';
    const END_DATE = '2024-06-07T09:00:00Z';

    const adjustedGenerationData = mockEnergyGenerations.map((generation) => {
      return {
        ...generation,
        truncatedDate: moment(generation.date).startOf('day').toISOString(),
      };
    });

    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          generation.date > START_DATE &&
          generation.date <= END_DATE &&
          generation.energy_generator_id === SUBURB_ID
      )
      .reduce((acc: any, generation: any) => {
        // Create a new generator if it doesn't exist
        if (!acc[generation.energy_generator_id]) {
          acc[generation.energy_generator_id] = {
            energy_generator_id: generation.energy_generator_id,
            energy: {},
          };
        }

        // Set initial value to 0 if it doesn't exist yet
        if (
          !acc[generation.energy_generator_id].energy[generation.truncatedDate]
        ) {
          acc[generation.energy_generator_id].energy[generation.truncatedDate] =
            {
              amount: 0,
              count: 0,
            };
        }

        // Add the amount to the existing value
        acc[generation.energy_generator_id].energy[
          generation.truncatedDate
        ].amount += generation.amount;
        acc[generation.energy_generator_id].energy[generation.truncatedDate]
          .count++;

        return acc;
      }, {});

    expectedEnergy = Object.keys(expectedEnergy).map((generatorId) => {
      return {
        energy_generator_id: parseInt(generatorId),
        energy: Object.keys(expectedEnergy[generatorId].energy).map((date) => {
          return {
            date,
            amount:
              (expectedEnergy[generatorId].energy[date].amount /
                expectedEnergy[generatorId].energy[date].count) *
              kWhConversionMultiplier('daily'),
          };
        }),
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
      generators: expectedEnergy,
    });
  });

  it('should return average energy generation of each generator in suburb in hourly time granularity', async () => {
    const SUBURB_ID = 2;
    const START_DATE = '2024-06-01T08:00:00Z';
    const END_DATE = '2024-06-07T10:00:00Z';

    const adjustedGenerationData = mockEnergyGenerations.map((generation) => {
      return {
        ...generation,
        truncatedDate: moment(generation.date).startOf('hour').toISOString(),
      };
    });

    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          generation.date > START_DATE &&
          generation.date <= END_DATE &&
          generation.energy_generator_id === SUBURB_ID
      )
      .reduce((acc: any, generation: any) => {
        // Create a new generator if it doesn't exist
        if (!acc[generation.energy_generator_id]) {
          acc[generation.energy_generator_id] = {
            energy_generator_id: generation.energy_generator_id,
            energy: {},
          };
        }

        // Set initial value to 0 if it doesn't exist yet
        if (
          !acc[generation.energy_generator_id].energy[generation.truncatedDate]
        ) {
          acc[generation.energy_generator_id].energy[generation.truncatedDate] =
            {
              amount: 0,
              count: 0,
            };
        }

        // Add the amount to the existing value
        acc[generation.energy_generator_id].energy[
          generation.truncatedDate
        ].amount += generation.amount;
        acc[generation.energy_generator_id].energy[generation.truncatedDate]
          .count++;

        return acc;
      }, {});

    expectedEnergy = Object.keys(expectedEnergy).map((generatorId) => {
      return {
        energy_generator_id: parseInt(generatorId),
        energy: Object.keys(expectedEnergy[generatorId].energy).map((date) => {
          return {
            date,
            amount:
              (expectedEnergy[generatorId].energy[date].amount /
                expectedEnergy[generatorId].energy[date].count) *
              kWhConversionMultiplier('hourly'),
          };
        }),
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
      generators: expectedEnergy,
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
      }),
      expect.objectContaining({
        id: '2', // Use string for ID
        name: 'Test Suburb 2',
        postcode: 3001,
        state: 'Victoria',
        latitude: '105', // Use string for latitude
        longitude: '100', // Use string for longitude
      }),
    ]);
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
        date: moment().subtract(34, 'minutes').toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 10,
      },
      {
        consumer_id: 2, // high priority
        date: moment().subtract(34, 'minutes').toISOString(), // last log was >5 minutes ago ==> power outage
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
        date: moment().subtract(4, 'minutes').toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 10,
      },
      {
        consumer_id: 2, // high priority
        date: moment().subtract(4, 'minutes').toISOString(), // last log was <5 minutes ago ==> no power outage
        amount: 5,
      },
      {
        consumer_id: 3,
        date: moment().subtract(4, 'minutes').toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 10,
      },
      {
        consumer_id: 4, // high priority
        date: moment().subtract(4, 'minutes').toISOString(), // last log was <5 minutes ago ==> no power outage
        amount: 4,
      },
      {
        consumer_id: 5,
        date: moment().subtract(4, 'minutes').toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 6,
      },
      {
        consumer_id: 6,
        date: moment().subtract(4, 'minutes').toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 6,
      },
      {
        consumer_id: 7,
        date: moment().subtract(4, 'minutes').toISOString(), // last log was <30 minutes ago ==> no power outage
        amount: 6,
      },
      {
        consumer_id: 1,
        date: moment().subtract(2, 'minutes').toISOString(),
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
        date: moment().subtract(36, 'minutes').toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 10,
      },
      {
        consumer_id: 2, // high priority
        date: moment().subtract(40, 'minutes').toISOString(), // last log was >5 minutes ago ==> power outage
        amount: 5,
      },
      {
        consumer_id: 3,
        date: moment().subtract(48, 'minutes').toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 10,
      },
      {
        consumer_id: 4, // high priority
        date: moment().subtract(2, 'minutes').toISOString(), // last log was <5 minutes ago ==> no power outage
        amount: 4,
      },
      {
        consumer_id: 5,
        date: moment().subtract(58, 'minutes').toISOString(), // last log was >30 minutes ago ==> power outage
        amount: 6,
      },
      // No data for consumer_id = 6 and is high priority => power outage

      {
        consumer_id: 6,
        date: moment().subtract(58, 'minutes').toISOString(), // last log was >30 minutes ago ==> power outage
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

describe('GET /retailer/reports/:id Suburb', () => {
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
    { date: '2024-02-02T00:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1, energy_generator_id: 0 },
    //outside of range energy
    { date: '2024-05-06T00:00:00.000Z', amount: 1, energy_generator_id: 0 },
    { date: '2024-05-07T00:00:00.000Z', amount: 1, energy_generator_id: 0 },

    //solar 1 energy
    { date: '2024-02-02T00:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1, energy_generator_id: 1 },
    //outside of range energy
    { date: '2024-05-06T00:00:00.000Z', amount: 1, energy_generator_id: 1 },
    { date: '2024-05-07T00:00:00.000Z', amount: 1, energy_generator_id: 1 },

    // solar 2 energy
    { date: '2024-02-02T00:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1, energy_generator_id: 2 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1, energy_generator_id: 2 },

    // wind energy
    { date: '2024-02-02T00:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1, energy_generator_id: 3 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1, energy_generator_id: 3 },

    // extra wind energy that shouldn't appear in any reports
    { date: '2024-02-02T00:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-03T00:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-04T00:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-05T00:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-06T00:00:00.000Z', amount: 1, energy_generator_id: 4 },
    { date: '2024-02-07T00:00:00.000Z', amount: 1, energy_generator_id: 4 },
  ];

  const testReports = [
    // This report's suburb will have no energy but will have profit
    {
      id: '0',
      start_date: '2024-02-01T00:00:00.000Z',
      end_date: '2024-03-01T00:00:00.000Z',
      suburb_id: '0',
      consumer_id: null,
    },
    // This report's dates will have no data
    {
      id: '1',
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-02-01T00:00:00.000Z',
      suburb_id: '1',
      consumer_id: null,
    },
    // This report will have data
    {
      id: '2',
      start_date: '2024-02-01T00:00:00.000Z',
      end_date: '2024-03-01T00:00:00.000Z',
      suburb_id: '1',
      consumer_id: null,
    },
  ];

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);
    const models = appInstance.get('models');

    // Create mock data
    await models.Suburb.bulkCreate(testSuburbs);
    await models.SuburbConsumption.bulkCreate(testSuburbConsumptions);

    await models.SellingPrice.bulkCreate(testSellingPrice);
    await models.SpotPrice.bulkCreate(testSpotPrice);

    await models.GeneratorType.bulkCreate(testGeneratorType);
    await models.EnergyGenerator.bulkCreate(testEnergyGenerator);
    await models.EnergyGeneration.bulkCreate(testEnergyGeneration);

    await models.Report.bulkCreate(testReports);
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
      energy: [],
      profits: [
        { date: '2024-02-02T00:00:00.000Z', amount: 0 },
        { date: '2024-02-03T00:00:00.000Z', amount: 0 },
        { date: '2024-02-04T00:00:00.000Z', amount: 0 },
        { date: '2024-02-05T00:00:00.000Z', amount: 0 },
        { date: '2024-02-06T00:00:00.000Z', amount: 0 },
        { date: '2024-02-07T00:00:00.000Z', amount: 0 },
      ],
      selling_prices: testSellingPrice,
      spot_prices: testSpotPrice,
      sources: [],
    });
  });

  it('Should return a full report', async () => {
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
      energy: [
        {
          start_date: '2024-02-01T00:00:00.000Z',
          end_date: '2024-02-02T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-02T00:00:00.000Z',
          end_date: '2024-02-03T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-03T00:00:00.000Z',
          end_date: '2024-02-04T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-04T00:00:00.000Z',
          end_date: '2024-02-05T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-05T00:00:00.000Z',
          end_date: '2024-02-06T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-06T00:00:00.000Z',
          end_date: '2024-02-07T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-07T00:00:00.000Z',
          end_date: '2024-02-08T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-08T00:00:00.000Z',
          end_date: '2024-02-09T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-09T00:00:00.000Z',
          end_date: '2024-02-10T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-10T00:00:00.000Z',
          end_date: '2024-02-11T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-11T00:00:00.000Z',
          end_date: '2024-02-12T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-12T00:00:00.000Z',
          end_date: '2024-02-13T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-13T00:00:00.000Z',
          end_date: '2024-02-14T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-14T00:00:00.000Z',
          end_date: '2024-02-15T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-15T00:00:00.000Z',
          end_date: '2024-02-16T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-16T00:00:00.000Z',
          end_date: '2024-02-17T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-17T00:00:00.000Z',
          end_date: '2024-02-18T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-18T00:00:00.000Z',
          end_date: '2024-02-19T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-19T00:00:00.000Z',
          end_date: '2024-02-20T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-20T00:00:00.000Z',
          end_date: '2024-02-21T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-21T00:00:00.000Z',
          end_date: '2024-02-22T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-22T00:00:00.000Z',
          end_date: '2024-02-23T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-23T00:00:00.000Z',
          end_date: '2024-02-24T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-24T00:00:00.000Z',
          end_date: '2024-02-25T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-25T00:00:00.000Z',
          end_date: '2024-02-26T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-26T00:00:00.000Z',
          end_date: '2024-02-27T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-27T00:00:00.000Z',
          end_date: '2024-02-28T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
        {
          start_date: '2024-02-28T00:00:00.000Z',
          end_date: '2024-02-29T00:00:00.000Z',
          generation: 24,
          consumption: 24,
        },
      ],
      selling_prices: testSellingPrice,
      spot_prices: testSpotPrice,
      profits: [
        { date: '2024-02-02T00:00:00.000Z', amount: 0 },
        { date: '2024-02-03T00:00:00.000Z', amount: 0 },
        { date: '2024-02-04T00:00:00.000Z', amount: 0 },
        { date: '2024-02-05T00:00:00.000Z', amount: 0 },
        { date: '2024-02-06T00:00:00.000Z', amount: 0 },
        { date: '2024-02-07T00:00:00.000Z', amount: 0 },
      ],
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
    });
  });

  it('Should split the events correctly. event>interval', async () => {
    const testEvents = [
      { date: '2024-02-02T00:00:00.000Z', amount: 1 },
      { date: '2024-02-03T00:00:00.000Z', amount: 1 },
      { date: '2024-02-04T00:00:00.000Z', amount: 2 },
      { date: '2024-02-05T00:00:00.000Z', amount: 2 },
      { date: '2024-02-06T00:00:00.000Z', amount: 1 },
      { date: '2024-02-07T00:00:00.000Z', amount: 1 },
    ];

    let results = splitEvents(
      testEvents,
      '2024-02-01T00:00:00.000Z',
      '2024-02-08T00:00:00.000Z',
      12
    );
    let expectedResults = [
      {
        start_date: '2024-02-01T00:00:00.000Z',
        end_date: '2024-02-01T12:00:00.000Z',
        total: 12,
      },
      {
        start_date: '2024-02-01T12:00:00.000Z',
        end_date: '2024-02-02T00:00:00.000Z',
        total: 12,
      },
      {
        start_date: '2024-02-02T00:00:00.000Z',
        end_date: '2024-02-02T12:00:00.000Z',
        total: 12,
      },
      {
        start_date: '2024-02-02T12:00:00.000Z',
        end_date: '2024-02-03T00:00:00.000Z',
        total: 12,
      },
      {
        start_date: '2024-02-03T00:00:00.000Z',
        end_date: '2024-02-03T12:00:00.000Z',
        total: 12,
      },
      {
        start_date: '2024-02-03T12:00:00.000Z',
        end_date: '2024-02-04T00:00:00.000Z',
        total: 24,
      },
      {
        start_date: '2024-02-04T00:00:00.000Z',
        end_date: '2024-02-04T12:00:00.000Z',
        total: 24,
      },
      {
        start_date: '2024-02-04T12:00:00.000Z',
        end_date: '2024-02-05T00:00:00.000Z',
        total: 24,
      },
      {
        start_date: '2024-02-05T00:00:00.000Z',
        end_date: '2024-02-05T12:00:00.000Z',
        total: 24,
      },
      {
        start_date: '2024-02-05T12:00:00.000Z',
        end_date: '2024-02-06T00:00:00.000Z',
        total: 12,
      },
      {
        start_date: '2024-02-06T00:00:00.000Z',
        end_date: '2024-02-06T12:00:00.000Z',
        total: 12,
      },
      {
        start_date: '2024-02-06T12:00:00.000Z',
        end_date: '2024-02-07T00:00:00.000Z',
        total: 12,
      },
      {
        start_date: '2024-02-07T00:00:00.000Z',
        end_date: '2024-02-07T12:00:00.000Z',
        total: 12,
      },
    ];
    console.log(results);
    expect(results).toEqual(expectedResults);
  });
  it('Should split the events correctly. event<interval', async () => {
    const testEvents = [
      { date: '2024-02-02T00:00:00.000Z', amount: 1 },
      { date: '2024-02-03T00:00:00.000Z', amount: 1 },
      { date: '2024-02-04T00:00:00.000Z', amount: 2 },
      { date: '2024-02-05T00:00:00.000Z', amount: 2 },
      { date: '2024-02-06T00:00:00.000Z', amount: 1 },
      { date: '2024-02-07T00:00:00.000Z', amount: 1 },
    ];

    let results = splitEvents(
      testEvents,
      '2024-02-01T00:00:00.000Z',
      '2024-02-07T00:00:00.000Z',
      48
    );
    let expectedResults = [
      {
        start_date: '2024-02-01T00:00:00.000Z',
        end_date: '2024-02-03T00:00:00.000Z',
        total: 48,
      },
      {
        start_date: '2024-02-03T00:00:00.000Z',
        end_date: '2024-02-05T00:00:00.000Z',
        total: 84,
      },
      {
        start_date: '2024-02-05T00:00:00.000Z',
        end_date: '2024-02-07T00:00:00.000Z',
        total: 60,
      },
    ];
    expect(results).toEqual(expectedResults);
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
      energy: [],
      selling_prices: [],
      spot_prices: [],
      profits: [],
      sources: [],
    });
  });
});

describe('GET /retailer/renewable-generation', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  const mockRenewableGenerationData = [
    { energy_generator_id: 1, date: '2024-01-01T09:00:00Z', amount: 100 },
    { energy_generator_id: 1, date: '2024-01-01T09:30:00Z', amount: 200 },
    { energy_generator_id: 1, date: '2024-02-01T09:00:00Z', amount: 200 },
    { energy_generator_id: 1, date: '2024-02-01T09:30:00Z', amount: 300 },
    { energy_generator_id: 1, date: '2024-03-01T09:00:00Z', amount: 300 },
    { energy_generator_id: 1, date: '2024-03-01T09:30:00Z', amount: 400 },
    { energy_generator_id: 1, date: '2024-04-01T09:00:00Z', amount: 400 },
    { energy_generator_id: 1, date: '2024-04-01T09:30:00Z', amount: 500 },
    // Non-renewable data should not be included in results
    { energy_generator_id: 2, date: '2024-01-01T09:00:00Z', amount: 500 },
    { energy_generator_id: 2, date: '2024-02-01T09:30:00Z', amount: 600 },
  ];

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    const Suburb = appInstance.get('models').Suburb;
    const GeneratorType = appInstance.get('models').GeneratorType;
    const EnergyGenerator = appInstance.get('models').EnergyGenerator;
    const EnergyGeneration = appInstance.get('models').EnergyGeneration;

    // Insert prerequisite data for tests
    await Suburb.bulkCreate([
      {
        id: 1,
        name: 'Test Suburb',
        postcode: 3000,
        state: 'Victoria',
        latitude: 0,
        longitude: 0,
      },
    ]);

    await GeneratorType.bulkCreate([
      { id: 1, category: 'Solar', renewable: true }, // Renewable generator
      { id: 2, category: 'Coal', renewable: false }, // Non-renewable generator
    ]);

    await EnergyGenerator.bulkCreate([
      { id: 1, name: 'Solar Generator', suburb_id: 1, generator_type_id: 1 }, // Renewable generator
      { id: 2, name: 'Coal Generator', suburb_id: 1, generator_type_id: 2 },  // Non-renewable generator
    ]);

    await EnergyGeneration.bulkCreate(mockRenewableGenerationData);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return error 400 if start date is missing', async () => {
    const response = await request(appInstance).get('/retailer/renewable-generation');

    expect(response.status).toBe(400);
  });

  it('should return error 400 if invalid suburb_id is provided', async () => {
    const SUBURB_ID = '1.111'; // Invalid suburb_id

    const response = await request(appInstance).get(
      `/retailer/renewable-generation?suburb_id=${SUBURB_ID}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if start date is invalid', async () => {
    const START_DATE = 'invalid-date';

    const response = await request(appInstance).get(
      `/retailer/renewable-generation?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return renewable energy generation with daily granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2024-01-01T00:00:00Z';
    const END_DATE = '2024-01-09T00:00:00Z';
  
    // Filter only the data within the requested date range BEFORE aggregation
    const filteredGenerationData = mockRenewableGenerationData
      .filter((generation) => 
        generation.energy_generator_id === 1 &&
        moment(generation.date).isBetween(START_DATE, END_DATE, null, '[]') // Inclusive filter
      )
      .map((generation) => {
        return {
          ...generation,
          truncatedDate: moment(generation.date).startOf('day').toISOString(),
        };
      });
  
    // Aggregate the data by day and calculate the average
    let expectedEnergy = filteredGenerationData.reduce((acc: any, generation: any) => {
      if (!acc[generation.truncatedDate]) {
        acc[generation.truncatedDate] = { amount: 0, count: 0 };
      }
      acc[generation.truncatedDate].amount += generation.amount;
      acc[generation.truncatedDate].count++;
      return acc;
    }, {});
  
    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount: 
          (expectedEnergy[date].amount / expectedEnergy[date].count) * 
          kWhConversionMultiplier('daily'), // Daily multiplier
      };
    });
  
    const response = await request(appInstance).get(
      `/retailer/renewable-generation?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );
  
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      renewable_energy: expectedEnergy,
    });
  });
  

  

  it('should return renewable energy generation with weekly granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2024-01-01T00:00:00Z';
    const END_DATE = '2024-06-01T00:00:00Z';

    const adjustedGenerationData = mockRenewableGenerationData
      .filter((generation) => generation.energy_generator_id === 1) // Only renewable generator data
      .map((generation) => {
        return {
          ...generation,
          truncatedDate: moment(generation.date).startOf('isoWeek').toISOString(),
        };
      });

    // Aggregate the data by week and average the amount
    let expectedEnergy = adjustedGenerationData.reduce((acc: any, generation: any) => {
      if (!acc[generation.truncatedDate]) {
        acc[generation.truncatedDate] = { amount: 0, count: 0 };
      }
      acc[generation.truncatedDate].amount += generation.amount;
      acc[generation.truncatedDate].count++;
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
      `/retailer/renewable-generation?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      suburb_id: SUBURB_ID,
      start_date: START_DATE,
      end_date: END_DATE,
      renewable_energy: expectedEnergy,
    });
  });

  it('should return nationwide renewable energy generation if no suburb_id is provided', async () => {
    const START_DATE = '2024-01-01T00:00:00Z';
    const END_DATE = '2024-06-01T00:00:00Z';

    const adjustedGenerationData = mockRenewableGenerationData
      .filter((generation) => generation.energy_generator_id === 1) // Only renewable generator data
      .map((generation) => {
        return {
          ...generation,
          truncatedDate: moment(generation.date).startOf('isoWeek').toISOString(),
        };
      });

    // Aggregate the data by week and average the amount
    let expectedEnergy = adjustedGenerationData.reduce((acc: any, generation: any) => {
      if (!acc[generation.truncatedDate]) {
        acc[generation.truncatedDate] = { amount: 0, count: 0 };
      }
      acc[generation.truncatedDate].amount += generation.amount;
      acc[generation.truncatedDate].count++;
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
      `/retailer/renewable-generation?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      renewable_energy: expectedEnergy,
    });
  });
});

