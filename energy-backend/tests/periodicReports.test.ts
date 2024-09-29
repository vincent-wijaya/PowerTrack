// Set node enviornment to Test
process.env.NODE_ENV = 'test';

import { Sequelize } from 'sequelize';
import { connectToTestDb, dropTestDb } from './testDb';
import moment from 'moment';
import { generatePeriodicReports } from '../utils/periodicReports';
import { defineModels } from '../databaseModels';

describe('Periodic Reports', () => {
  let sequelize: Sequelize;
  let models: any;

  beforeAll(async () => {
    sequelize = await connectToTestDb();
    models = defineModels(sequelize);
    const { Consumer, Suburb } = models;

    // Generate necessary data
    await Suburb.create(
      {
        id: 1,
        name: 'Test Suburb',
        postcode: 3000,
        state: 'Victoria',
        latitude: '100',
        longitude: '100',
      }
    );
    await Consumer.bulkCreate([
      {
        id: 1,
        street_address: '',
        high_priority: true,
        suburb_id: 1,
        latitude: 100,
        longitude: 100,
        selling_price_id: 1,
      },
      {
        id: 2,
        street_address: '',
        high_priority: false,
        suburb_id: 1,
        latitude: 100,
        longitude: 100,
        selling_price_id: 1,
      },
    ]);
  });

  afterAll(async () => {
    await dropTestDb(sequelize);
  });

  it('should generate weekly and monthly reports', async () => {
    const currentTime = moment().format();

    // Weekly report
    await generatePeriodicReports(sequelize, moment(currentTime).subtract(1, 'week').format(), currentTime);

    // Monthly report
    await generatePeriodicReports(sequelize, moment(currentTime).subtract(1, 'month').format(), currentTime);

    const { Report } = models;
    const weeklyReports = await Report.findAll({
      where: {
        start_date: moment(currentTime).subtract(1, 'week').format(),
        end_date: currentTime,
      },
    });
    const monthlyReports = await Report.findAll({
      where: {
        start_date: moment(currentTime).subtract(1, 'month').format(),
        end_date: currentTime,
      },
    });

    const NUM_CONSUMERS = 2;
    expect(weeklyReports.length).toBe(NUM_CONSUMERS);
    expect(monthlyReports.length).toBe(NUM_CONSUMERS);
  });
});
