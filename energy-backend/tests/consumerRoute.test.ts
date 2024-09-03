import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';
import { defineModels } from '../databaseModels';

type DbModelType = ReturnType<typeof defineModels>;

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

    const { SellingPrice } = await appInstance.get('models');
    // Insert prerequesite data for tests
    await SellingPrice.bulkCreate(sellingPriceTestData);
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('should return the latest retailer selling price', async () => {
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

describe('GET /consumer/greenEnergy', () => {
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
    await db.EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 0,
    });
    await db.EnergyGeneration.create({
      amount: 10,
      date: new Date().toISOString(),
      energy_generator_id: 1,
    });

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

  it('should return the green energy data', async () => {
    const response = await request(appInstance).get('/consumer/greenEnergy');

    // Get the latest selling price from the test data
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      greenUsagePercent: 0.5,
      greenGoalPercent: 1,
    });
  });
});
