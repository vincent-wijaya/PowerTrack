import express from 'express';
import { Sequelize } from 'sequelize';
import cors from 'cors';

import exampleRoute from './routes/exampleRoute';
import retailerRoute from './routes/retailerRoute';
import { defineModels } from './databaseModels';

const app = (sequelize: Sequelize) => {
  // Define models
  const models = defineModels(sequelize);

  // Set up app
  const app = express();

  if (process.env.NODE_ENV === 'development') {
    app.use(cors());
  }

  app.set('models', models);

  // Add routes here
  app.use('/', exampleRoute);
  app.use('/retailer', retailerRoute);

  return app;
};

export default app;
