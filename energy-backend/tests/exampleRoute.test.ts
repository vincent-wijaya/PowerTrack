import { Application } from 'express';
import { Sequelize } from 'sequelize';
import request from 'supertest';
import app from '../app';
import { connectToTestDb, dropTestDb } from './testDb';

// Test the example route
describe('GET /', () => {
  let sequelize: Sequelize;
  let appInstance: Application;

  beforeAll(async () => {
    // beforeAll hook runs before all tests
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    await sequelize.authenticate();
    appInstance = app(sequelize);
  });

  afterAll(async () => {
    // afterAll hook runs after all tests
    // Close connection to test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it("should return 'Hello World!'", async () => {
    const response = await request(appInstance).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World!');
  });
});
