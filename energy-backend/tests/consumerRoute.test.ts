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