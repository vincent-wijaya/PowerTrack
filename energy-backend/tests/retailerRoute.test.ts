import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import moment from 'moment';
import { kWhConversionMultiplier } from '../utils/utils';

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
        high_priority: false,
        selling_price_id: 1,
        suburb_id: 1,
      },
      {
        id: 2,
        street_address: '11 Test Street Melbourne Victoria 3000',
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
