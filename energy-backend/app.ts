import express from 'express';
import exampleRoute from './routes/exampleRoute';
const app = express();

// Add routes here
app.use('/', exampleRoute);

export default app;
