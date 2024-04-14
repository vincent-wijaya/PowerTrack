const express = require('express');
const app = express();

// Add routes here
const exampleRoute = require('./routes/exampleRoute');
app.use('/', exampleRoute);

module.exports = app;
