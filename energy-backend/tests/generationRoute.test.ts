// Set node enviornment to Test
process.env.NODE_ENV = 'test';

import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import { kWhConversionMultiplier } from '../utils/utils';
import {
  addYears,
  differenceInHours,
  startOfDay,
  startOfHour,
  startOfISOWeek,
} from 'date-fns';

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
    const START_DATE = '2023-06-01T09:00:00.000Z';
    const END_DATE = '2023-06-03T12:00:00.000Z';

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
    expect(response.body).toEqual({
      error: 'Start date must be provided.',
    });
  });

  it('should return error 400 if invalid start date format is provided', async () => {
    const START_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/generation?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if invalid end date format is provided', async () => {
    const START_DATE = '2024-01-01T09:00:00.000Z';
    const END_DATE = '01/01/2024'; // Invalid date format

    const response = await request(appInstance).get(
      `/retailer/generation?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if future start date is provided', async () => {
    const START_DATE = '2099-01-01T09:00:00.000Z'; // Future date

    const response = await request(appInstance).get(
      `/retailer/generation?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return with status and the generation with hourly granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2023-06-01T08:00:00.000Z';
    const END_DATE = '2023-06-03T12:00:00.000Z';

    const adjustedGenerationData = mockGenerationData.map((generation) => {
      return {
        ...generation,
        truncatedDate: startOfHour(generation.date).toISOString(),
      };
    });

    // Aggregate the data by week
    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          new Date(START_DATE) < new Date(generation.date) &&
          new Date(generation.date) <= new Date(END_DATE) &&
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
    const START_DATE = '2023-06-01T08:00:00.000Z';
    const END_DATE = '2023-06-08T08:00:00.000Z';

    const adjustedGenerationData = mockGenerationData.map((generation) => {
      return {
        ...generation,
        truncatedDate: startOfDay(generation.date).toISOString(),
      };
    });

    // Aggregate the data by week
    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          new Date(START_DATE) < new Date(generation.date) &&
          new Date(generation.date) <= new Date(END_DATE) &&
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
    const START_DATE = '2023-01-01T08:00:00.000Z';
    const END_DATE = '2023-08-01T08:00:00.000Z';

    const adjustedGenerationData = mockGenerationData.map((generation) => {
      return {
        ...generation,
        truncatedDate: startOfISOWeek(generation.date).toISOString(),
      };
    });

    // Aggregate the data by week and averaging the amount
    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          new Date(generation.date) > new Date(START_DATE) &&
          new Date(generation.date) <= new Date(END_DATE) &&
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
    const START_DATE = '2023-01-01T08:00:00.000Z';
    const END_DATE = '2023-08-01T08:00:00.000Z';

    const adjustedGenerationData = mockGenerationData.map((generation) => {
      return {
        ...generation,
        truncatedDate: startOfISOWeek(generation.date).toISOString(),
      };
    });

    // Aggregate the data by week
    let expectedEnergy = adjustedGenerationData
      .filter(
        (generation) =>
          new Date(START_DATE) < new Date(generation.date) &&
          new Date(generation.date) <= new Date(END_DATE)
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
        truncatedDate: startOfISOWeek(generation.date).toISOString(),
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
        truncatedDate: startOfDay(generation.date).toISOString(),
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
        truncatedDate: startOfHour(generation.date).toISOString(),
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

describe('GET /retailer/renewableGeneration', () => {
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
      { id: 2, name: 'Coal Generator', suburb_id: 1, generator_type_id: 2 }, // Non-renewable generator
    ]);

    await EnergyGeneration.bulkCreate(mockRenewableGenerationData);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return error 400 if start date is missing', async () => {
    const response = await request(appInstance).get(
      '/retailer/renewableGeneration'
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Start date must be provided.',
    });
  });

  it('should return error 400 if invalid suburb_id is provided', async () => {
    const SUBURB_ID = '1.111'; // Invalid suburb_id

    const response = await request(appInstance).get(
      `/retailer/renewableGeneration?suburb_id=${SUBURB_ID}`
    );

    expect(response.status).toBe(400);
  });

  it('should return error 400 if start date is invalid', async () => {
    const START_DATE = 'invalid-date';

    const response = await request(appInstance).get(
      `/retailer/renewableGeneration?start_date=${START_DATE}`
    );

    expect(response.status).toBe(400);
  });

  it('should return renewable energy generation with daily granularity', async () => {
    const SUBURB_ID = 1;
    const START_DATE = '2024-01-01T00:00:00Z';
    const END_DATE = '2024-01-09T00:00:00Z';

    // Filter only the data within the requested date range BEFORE aggregation
    const filteredGenerationData = mockRenewableGenerationData
      .filter(
        (generation) =>
          generation.energy_generator_id === 1 &&
          new Date(generation.date) > new Date(START_DATE) &&
          new Date(generation.date) <= new Date(END_DATE)
      )
      .map((generation) => {
        return {
          ...generation,
          truncatedDate: startOfDay(generation.date).toISOString(),
        };
      });

    // Aggregate the data by day and calculate the average
    let expectedEnergy = filteredGenerationData.reduce(
      (acc: any, generation: any) => {
        if (!acc[generation.truncatedDate]) {
          acc[generation.truncatedDate] = { amount: 0, count: 0 };
        }
        acc[generation.truncatedDate].amount += generation.amount;
        acc[generation.truncatedDate].count++;
        return acc;
      },
      {}
    );

    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount:
          (expectedEnergy[date].amount / expectedEnergy[date].count) *
          kWhConversionMultiplier('daily'), // Daily multiplier
      };
    });

    const response = await request(appInstance).get(
      `/retailer/renewableGeneration?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
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
          truncatedDate: startOfISOWeek(generation.date).toISOString(),
        };
      });

    // Aggregate the data by week and average the amount
    let expectedEnergy = adjustedGenerationData.reduce(
      (acc: any, generation: any) => {
        if (!acc[generation.truncatedDate]) {
          acc[generation.truncatedDate] = { amount: 0, count: 0 };
        }
        acc[generation.truncatedDate].amount += generation.amount;
        acc[generation.truncatedDate].count++;
        return acc;
      },
      {}
    );

    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount:
          (expectedEnergy[date].amount / expectedEnergy[date].count) *
          kWhConversionMultiplier('weekly'), // Gets the average amount
      };
    });

    const response = await request(appInstance).get(
      `/retailer/renewableGeneration?suburb_id=${SUBURB_ID}&start_date=${START_DATE}&end_date=${END_DATE}`
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
          truncatedDate: startOfISOWeek(generation.date).toISOString(),
        };
      });

    // Aggregate the data by week and average the amount
    let expectedEnergy = adjustedGenerationData.reduce(
      (acc: any, generation: any) => {
        if (!acc[generation.truncatedDate]) {
          acc[generation.truncatedDate] = { amount: 0, count: 0 };
        }
        acc[generation.truncatedDate].amount += generation.amount;
        acc[generation.truncatedDate].count++;
        return acc;
      },
      {}
    );

    expectedEnergy = Object.keys(expectedEnergy).map((date) => {
      return {
        date,
        amount:
          (expectedEnergy[date].amount / expectedEnergy[date].count) *
          kWhConversionMultiplier('weekly'), // Gets the average amount
      };
    });

    const response = await request(appInstance).get(
      `/retailer/renewableGeneration?start_date=${START_DATE}&end_date=${END_DATE}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      start_date: START_DATE,
      end_date: END_DATE,
      renewable_energy: expectedEnergy,
    });
  });
});

describe('GET /retailer/greenEnergy', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    appInstance = app(sequelize);

    // Insert prerequesite data for tests

    const db = await appInstance.get('models');
    await db.GeneratorType.bulkCreate([
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
    ]);
    await db.Suburb.create({
      id: 1,
      name: 'Test Suburb',
      postcode: 3000,
      state: 'Victoria',
      latitude: 0,
      longitude: 0,
    });
    await db.EnergyGenerator.bulkCreate([
      { id: 0, name: 'Gen 0', generator_type_id: 1, suburb_id: 1 },
      { id: 1, name: 'Gen 1', generator_type_id: 2, suburb_id: 1 },
    ]);

    await db.GoalType.create({
      id: 4,
      category: 'green_energy',
      description:
        'I want the majority of my energy to come from environmentally-friendly sources.',
      target_type: 'consumer',
    });
    await db.WarningType.create({
      id: 6,
      category: 'fossil_fuels',
      description: 'High usage of energy from fossil fuel sources',
      trigger_greater_than: true,
      target: 0.5,
      goal_type_id: 4,
    });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  afterEach(async () => {
    // Clear the ConsumerConsumption table
    await appInstance.get('models').EnergyGeneration.destroy({
      where: {},
      truncate: true,
    });
  });

  it('should return error if no generation records exist', async () => {
    const response = await request(appInstance).get('/retailer/greenEnergy');

    expect(response.status).toBe(400);
  });

  it('should return 0% green usage if no renewable energy generation', async () => {
    const { EnergyGeneration } = appInstance.get('models');

    await EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 0,
    });

    const response = await request(appInstance).get('/retailer/greenEnergy');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      green_usage_percent: 0,
      green_goal_percent: 0,
    });
  });

  it('should return 100% green usage if no non-renewable energy generation', async () => {
    const { EnergyGeneration } = appInstance.get('models');

    await EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 1,
    });

    const response = await request(appInstance).get('/retailer/greenEnergy');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      green_usage_percent: 1,
      green_goal_percent: 2,
    });
  });

  it('should return the green energy data', async () => {
    const { EnergyGeneration } = appInstance.get('models');

    await EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 0,
    });
    await EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 1,
    });

    const response = await request(appInstance).get('/retailer/greenEnergy');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      green_usage_percent: 0.5,
      green_goal_percent: 1,
    });
  });
});
