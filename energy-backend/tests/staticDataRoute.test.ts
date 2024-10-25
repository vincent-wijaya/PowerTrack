// Set node enviornment to Test
process.env.NODE_ENV = 'test';

import { Application } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';

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
