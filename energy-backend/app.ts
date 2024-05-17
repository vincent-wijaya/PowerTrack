import express from "express";
import { Sequelize } from "sequelize";
import exampleRoute from "./routes/exampleRoute";
import retailerRoute from "./routes/retailerRoute";
import { defineModels } from "./databaseModels";

const app = (sequelize: Sequelize) => {
  // Define models
  const models = defineModels(sequelize);

  // Set up app
  const app = express();
  app.set("models", models);

  // Set up CORs
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3001");
    next();
  });

  // Add routes here
  app.use("/", exampleRoute);
  app.use("/retailer", retailerRoute);

  return app;
};

export default app;
