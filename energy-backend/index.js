const express = require("express");
const app = express();
const port = 3000;

// Add routes here
const exampleRoute = require("./routes/example_route");
app.use("/", exampleRoute);

// Listen on port 3000
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
