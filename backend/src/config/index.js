const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this";

module.exports = {
  PORT,
  JWT_SECRET
};
