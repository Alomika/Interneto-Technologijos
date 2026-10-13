require("dotenv").config();

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const app = require("./src/app");
const { PORT } = require("./src/config");
const { initDatabase } = require("./src/db/init");

initDatabase();

if (process.env.USE_HTTP === "true") {
  http.createServer(app).listen(PORT, () => {
    console.log(`Backend API running on http://localhost:${PORT}`);
  });
} else {
  const pfxPath = path.join(__dirname, "src", "utils", "localhost.pfx");
  const httpsOptions = {
    pfx: fs.readFileSync(pfxPath),
    passphrase: process.env.PFX_PASSPHRASE || ""
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Backend API running on https://localhost:${PORT}`);
  });
}
