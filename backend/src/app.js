const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const apiRoutes = require("./routes/apiRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use("/api", apiRoutes);

// Respond to GET /
app.get("/", (req, res) => {
  res.send("Backend is running.");
});

module.exports = app;
