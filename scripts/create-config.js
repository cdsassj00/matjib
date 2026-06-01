const fs = require("node:fs");
const path = require("node:path");

const sourceName = process.env.GOOGLE_MAPS_API_KEY ? "GOOGLE_MAPS_API_KEY" : "VITE_GOOGLE_MAPS_API_KEY";
const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
const configPath = path.join(__dirname, "..", "config.js");
const contents = `window.MAPS_PLATFORM_API_KEY = ${JSON.stringify(apiKey)};\n`;

fs.writeFileSync(configPath, contents, "utf8");

if (apiKey) {
  console.log(`config.js generated from ${sourceName}.`);
} else {
  console.warn("config.js generated with an empty API key. Set GOOGLE_MAPS_API_KEY for deployment.");
}
