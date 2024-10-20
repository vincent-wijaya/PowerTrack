import express from 'express';
import { Sequelize } from 'sequelize';
import cors from 'cors';

import exampleRoute from './routes/exampleRoute';
import retailerRoute from './routes/retailerRoute';
import consumerRoute from './routes/consumerRoute';
import consumptionRoute from './routes/consumptionRoute';
import { defineModels } from './databaseModels';
import reportRoute from './routes/reportRoute';
import generationRoute from './routes/generationRoute';
import staticDataRoute from './routes/staticDataRoute';

const app = (sequelize: Sequelize) => {
  // Define models
  const models = defineModels(sequelize);

  // Set up app
  const app = express();
  app.use(express.json());

  if (process.env.NODE_ENV === 'development') {
    app.use(cors());
  }

  app.set('models', models);

  // Add routes here
  app.use('/', exampleRoute);
  app.use(
    '/retailer',
    retailerRoute,
    generationRoute,
    consumptionRoute,
    staticDataRoute
  );
  app.use('/consumer', consumerRoute);
  app.use('/retailer/reports', reportRoute);

  return app;
};

export default app;
