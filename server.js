const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const connectDB = require("./config/db");
connectDB();

const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Welcome to the PSG Transport Management API");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
