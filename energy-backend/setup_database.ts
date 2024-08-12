import { Sequelize } from 'sequelize';
import { defineModels } from './databaseModels';
import fs from 'node:fs';

async function createHypertables(sequelize: Sequelize, tableNames: String[]) {
  for (let tableName of tableNames) {
    await sequelize
      .query(`SELECT create_hypertable('${tableName}', by_range('date'));`)
      .catch((error) => {
        console.error(`Unable to create hypertable for ${tableName}: `, error);
      });
  }
}

async function setupDatabase(sequelize: Sequelize) {
  // Define the database schema
  const models = defineModels(sequelize);
  sequelize = models.sequelize;
  // Write the database schema to the database
  await sequelize
    .sync({ force: true })
    .then(() => {
      console.log('Database schema synced');
    })
    .catch((error) => {
      console.error('Unable to sync database schema: ', error);
    });

  /* Convert relevant databases into timescale db hypertables */
  await createHypertables(sequelize, [
    'suburb_consumption',
    'consumer_consumption',
    'energy_generation',
    'selling_price',
    'spot_price',
  ]);
}

/**
 *
 * Expects data in the form of a list of entries
 * each entry should specify the name of the model, and then a list of entries for that model
 * these entries are in the same form as given to a sequelize .create call.
 *
 * eg
 *  [
 *    {
 *      name: "Consumer",
 *      values:[
 *        {...}
 *      ]
 *    }
 *  ]
 * Entries are inserted in the order given in the JSON file to preserve table relations
 *
 * @param sequelize The database connection object to use
 * @param data The data to enter into the database. See above for how this should be arranged
 */
async function loadDatabaseJSON(sequelize: Sequelize, data: any[]) {
  for (const model of data) {
    if (sequelize.models[model.name]) {
      try {
        await sequelize.models[model.name].bulkCreate(model.values);
      } catch (e) {
        console.error(
          `Unable to insert data for ${model.name} with data ${model.values}`
        );
        throw e;
      }
    } else {
      console.info(`Skipping invalid model name ${model.name}`);
    }
  }
}

if (require.main === module) {
  // Execute the following if this file is run from the command line
  const DATABASE_URI: string | undefined = process.env.DATABASE_URI;
  const DB_SETUP_FILE: string | undefined = process.env.DB_SETUP_FILE;
  if (!DATABASE_URI) {
    throw new Error('Environment variable DATABASE_URI is not set.');
  }
  if (!DB_SETUP_FILE) {
    throw new Error('Environment variable DB_SETUP_FILE not set');
  }
  const sequelize = new Sequelize(DATABASE_URI, {
    dialect: 'postgres',
    protocol: 'postgres',
    define: { timestamps: false }, // remove created and updated timestamps from models
    dialectOptions: {},
  });
  setupDatabase(sequelize).then(
    //setup the database schema and hypertables
    () => {
      try {
        const data = JSON.parse(fs.readFileSync(DB_SETUP_FILE, 'utf8'));

        if (process.env.NODE_ENV === 'development') {
          const debugData = JSON.parse(
            fs.readFileSync('debug' + DB_SETUP_FILE, 'utf8')
          );
          data.push(...debugData);
        }
        loadDatabaseJSON(sequelize, data); // load data from json into the database
      } catch (e: any) {
        if (e instanceof SyntaxError) {
          console.error(`Could not parse '${DB_SETUP_FILE}'`);
        } else if (e.code === 'ENOENT') {
          console.error(`Could not find '${DB_SETUP_FILE}'`);
        }
        throw e;
      }
    }
  );
}

export default setupDatabase;

// Only export these functions if the node enviornment is set to testing
export let exportsForTesting: {
  createHypertables: (seq: Sequelize, names: String[]) => Promise<void>;
  loadDatabaseJSON: (seq: Sequelize, data: any[]) => Promise<void>;
};
if (process.env.NODE_ENV === 'test') {
  exportsForTesting = { createHypertables, loadDatabaseJSON };
}
