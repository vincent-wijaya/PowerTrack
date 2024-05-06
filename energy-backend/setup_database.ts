import { Sequelize } from 'sequelize';
import { defineModels } from './databaseModels';

async function setupDatabase(sequelize: Sequelize) {
  // Define the database schema
  const models = defineModels(sequelize);
  sequelize = models.sequelize;
  // Write the database schema to the database
  await sequelize.sync({ force: true })
    .then(() => {
    console.log("Database schema synced");
    })
    .catch((error) => {
    console.error("Unable to sync database schema: ", error);
    });
/* Convert relevant databases into timescale db hypertables */
  await sequelize.query("SELECT create_hypertable('suburb_consumption', by_range('date'));").catch((error) => {
    console.error("Unable to create hypertable for suburb_consumption: ", error);
  });
  await sequelize.query("SELECT create_hypertable('consumer_consumption', by_range('date'));").catch((error) => {
    console.error("Unable to create hypertable for consumer_consumption: ", error);
  });
  await sequelize.query("SELECT create_hypertable('energy_generation', by_range('date'));").catch((error) => {
    console.error("Unable to create hypertable for energy_generation: ", error);
  });
  await sequelize.query("SELECT create_hypertable('selling_price', by_range('date'));").catch((error) => {
    console.error("Unable to create hypertable for selling_price: ", error);
  });
  await sequelize.query("SELECT create_hypertable('spot_price', by_range('date'));").catch((error) => {
    console.error("Unable to create hypertable for spot_price: ", error);
  });
}

if (require.main === module) {
  // Execute the following if this file is run from the command line
  const DATABASE_URI: string | undefined = process.env.DATABASE_URI;
  if (!DATABASE_URI) {
    throw new Error("Environment variable DATABASE_URI is not set.");
  }

  setupDatabase(
    new Sequelize(DATABASE_URI, {
      dialect: "postgres",
      protocol: "postgres",
      dialectOptions: {},
    })
  );
}

export default setupDatabase;
