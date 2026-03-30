require("dotenv").config();

const app = require("./src/app");
const { PORT } = require("./src/config");
const { initDatabase } = require("./src/db/init");

initDatabase();

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
