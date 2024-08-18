import express from 'express';
import { Sequelize } from 'sequelize';
import exampleRoute from './routes/exampleRoute';
import retailerRoute from './routes/retailerRoute';
import { defineModels } from './databaseModels';

const cors = require('cors');

const app = (sequelize: Sequelize) => {
  // Define models
  const models = defineModels(sequelize);

  // Set up app
  const app = express();

  // Middleware so that we can parse JSON in the request body for POST requests
  app.use(express.json());

  // Set models in app so that they can be accessed in routes
  app.set('models', models);

  app.use(cors());
  // Add routes here
  app.use('/', exampleRoute);
  app.use('/retailer', retailerRoute);

  return app;
};

export default app;
