const app = require("../app");
const { connectDB } = require("../db/connectDb");

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};
