// Set node enviornment to Test
process.env.NODE_ENV = 'test';
import { connectToTestDb, dropTestDb } from './testDb';
import { Sequelize } from 'sequelize';
import { defineModels } from '../databaseModels';
import { exportsForTesting } from '../setup_database';
const { createHypertables, loadDatabaseJSON } = exportsForTesting;

describe('setupDatabase', () => {
  let sequelize: Sequelize;
  beforeAll(async () => {
    // Set up and connect to test database
    sequelize = await connectToTestDb();
    // We have to reset the database to have no data just models
    defineModels(sequelize);
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    // Drop the test database
    await sequelize.close();
    await dropTestDb(sequelize);
  });

  it('Should insert data into given tables', async () => {
    let testData: any[] = [
      {
        name: 'suburb',
        values: [
          {
            id: '0',
            name: 'Khancoban',
            postcode: 2642,
            state: 'NSW',
            latitude: '-36.2540',
            longitude: '148.15396',
          },
          {
            id: '1',
            name: 'Tawonga',
            postcode: 3697,
            state: 'VIC',
            latitude: '-36.6721',
            longitude: '147.20511',
          },
          {
            id: '2',
            name: 'Bright',
            postcode: 3741,
            state: 'VIC',
            latitude: '-36.69513',
            longitude: '147.03141',
          },
        ],
      },
    ];

    await loadDatabaseJSON(sequelize, testData);

    let tableEntries = await sequelize.query('SELECT * FROM suburb;');
    expect(tableEntries[0].length).toEqual(testData[0].values.length);

    let results = tableEntries[0].sort();
    let testValues = testData[0].values.sort();
    expect(results).toEqual(testValues);
  });
  it('Should insert data in the right order', async () => {
    let testData: any[] = [
      {
        name: 'suburb',
        values: [
          {
            id: '3',
            name: 'Khancoban',
            postcode: 2642,
            state: 'NSW',
            latitude: -36.25405,
            longitude: 148.15396,
          },
          {
            id: '4',
            name: 'Tawonga',
            postcode: 3697,
            state: 'VIC',
            latitude: -36.6721,
            longitude: 147.20511,
          },
          {
            id: '5',
            name: 'Bright',
            postcode: 3741,
            state: 'VIC',
            latitude: -36.69513,
            longitude: 147.03141,
          },
        ],
      },
      {
        name: 'consumer',
        values: [
          {
            id: '0',
            street_address: '11 Princes Street Carlton',
            suburb_id: '4',
            high_priority: false,
          },
          {
            id: '1',
            street_address: '523 Swanston Street Carlton',
            suburb_id: '4',
            high_priority: false,
          },
          {
            id: '2',
            street_address: '57 Barkly Street Carlton',
            suburb_id: '5',
            high_priority: false,
          },
        ],
      },
    ];

    await expect(loadDatabaseJSON(sequelize, testData)).resolves.not.toThrow();
  });
  it('Should fail to insert data in the wrong order', async () => {
    let testData: any[] = [
      {
        name: 'consumer',
        values: [
          {
            id: '3',
            street_address: '11 Princes Street Carlton',
            suburb_id: '7',
            high_priority: false,
          },
          {
            id: '4',
            street_address: '523 Swanston Street Carlton',
            suburb_id: '7',
            high_priority: false,
          },
          {
            id: '5',
            street_address: '57 Barkly Street Carlton',
            suburb_id: '8',
            high_priority: false,
          },
        ],
      },
      {
        name: 'suburb',
        values: [
          {
            id: '6',
            name: 'Khancoban',
            postcode: 2642,
            state: 'NSW',
            latitude: -36.25405,
            longitude: 148.15396,
          },
          {
            id: '7',
            name: 'Tawonga',
            postcode: 3697,
            state: 'VIC',
            latitude: -36.6721,
            longitude: 147.20511,
          },
          {
            id: '8',
            name: 'Bright',
            postcode: 3741,
            state: 'VIC',
            latitude: -36.69513,
            longitude: 147.03141,
          },
        ],
      },
    ];

    await expect(loadDatabaseJSON(sequelize, testData)).rejects.toThrow();
  });

  it('Should create hypertables', async () => {
    let hypertableNames: String[] = [
      'suburb_consumption',
      'consumer_consumption',
    ];

    await createHypertables(sequelize, hypertableNames);
    let hyperTables = await sequelize.query(
      'SELECT hypertable_name FROM timescaledb_information.hypertables;'
    );

    // Should have two results
    expect(hyperTables[0].length).toEqual(hypertableNames.length);
    let tableNames = hyperTables[0].map((table: any) => table.hypertable_name);

    //hypertable names should match the table names given
    tableNames = tableNames.sort();
    hypertableNames = tableNames.sort();
    expect(tableNames).toEqual(hypertableNames);
    console.log(hyperTables);
  });
});
