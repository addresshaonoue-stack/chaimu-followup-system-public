const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: process.env.ENV_FILE || path.join(__dirname, "..", ".env")
});
