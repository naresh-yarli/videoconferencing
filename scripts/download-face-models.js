// scripts/download-face-models.js
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const modelsDir = path.join(__dirname, "../public/models");

// Create models directory if it doesn't exist
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// Base URL for the models
const BASE_URL =
  "https://github.com/justadudewhohacks/face-api.js/raw/master/weights";

// Models to download
const models = [
  "tiny_face_detector_model-shard1",
  "tiny_face_detector_model-weights_manifest.json",
];

// Download each model
models.forEach((model) => {
  const url = `${BASE_URL}/${model}`;
  const filePath = path.join(modelsDir, model);

  console.log(`Downloading ${model}...`);

  const file = fs.createWriteStream(filePath);
  https
    .get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log(`Downloaded ${model}`);
      });
    })
    .on("error", (err) => {
      fs.unlink(filePath);
      console.error(`Error downloading ${model}: ${err.message}`);
    });
});

console.log("All downloads initiated. Please wait for completion.");
