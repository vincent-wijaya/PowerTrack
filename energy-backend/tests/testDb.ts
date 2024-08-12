import { Sequelize } from 'sequelize';
import { v4 as uuid } from 'uuid';
import setupDatabase from '../setup_database';

/**
 * Connects to a test database and returns the Sequelize instance.
 *
 * @returns {Sequelize} A Sequelize instance connected to the test database.
 */
export const connectToTestDb = async () => {
  // Create a new test database using the root connection
  let rootSequelize = new Sequelize(process.env.DATABASE_URI!, {
    dialect: 'postgres',
    protocol: 'postgres',
    define: { timestamps: false }, // remove created and updated timestamps from models
    dialectOptions: {},
  });
  const dbName = `test_db_${uuid().replace(/-/g, '_')}`; // Replace "-" with "_"
  await rootSequelize.query(`CREATE DATABASE ${dbName};`).catch((err: any) => {
    console.log(`Error creating database ${dbName}: ${err.message}`);
  });
  await rootSequelize.close();
  let testSequelize = new Sequelize(
    `${process.env.TEST_DATABASE_CLUSTER}${dbName}`,
    {
      dialect: 'postgres',
      protocol: 'postgres',
      define: { timestamps: false }, // remove created and updated timestamps from models
      dialectOptions: {},
    }
  );
  await setupDatabase(testSequelize);
  return testSequelize;
};

/**
 * Drops the test database and closes the connection.
 *
 * @param {Sequelize} sequelize The Sequelize instance to close.
 */
export const dropTestDb = async (sequelize: Sequelize) => {
  // If sequelize connection is not closed, then close it
  if (sequelize) {
    await sequelize.close();
  }
  // Drop the test database using the root connection
  let rootSequelize = new Sequelize(process.env.DATABASE_URI!);
  const dbName = sequelize.getDatabaseName();
  await rootSequelize.query(`DROP DATABASE ${dbName};`).catch((err: any) => {
    console.log(`Error dropping database ${dbName}: ${err.message}`);
  });
  await rootSequelize.close();
};
