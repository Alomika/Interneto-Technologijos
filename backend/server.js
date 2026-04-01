require("dotenv").config();

const fs = require("fs");
const https = require("https");
const path = require("path");
const app = require("./src/app");
const { PORT } = require("./src/config");
const { initDatabase } = require("./src/db/init");

initDatabase();

const pfxPath = path.join(__dirname, "src", "utils", "localhost.pfx");

console.log("[DEBUG] Using PFX path:", pfxPath);
console.log("[DEBUG] Using passphrase:", process.env.PFX_PASSPHRASE);
const httpsOptions = {
  pfx: fs.readFileSync(pfxPath),
  passphrase: process.env.PFX_PASSPHRASE || ""
};

https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`Backend API running on https://localhost:${PORT}`);
});
