// scripts/check-face-models.js
const fs = require("fs");
const path = require("path");
const https = require("https");

const modelsDir = path.join(__dirname, "../public/models");

// Create models directory if it doesn't exist
if (!fs.existsSync(modelsDir)) {
  console.log("Creating models directory...");
  fs.mkdirSync(modelsDir, { recursive: true });
}

// Base URL for the models
const BASE_URL =
  "https://github.com/justadudewhohacks/face-api.js/raw/master/weights";

// Models to check and download if needed
const models = [
  "tiny_face_detector_model-shard1",
  "tiny_face_detector_model-weights_manifest.json",
];

// Check and download each model if needed
models.forEach((model) => {
  const filePath = path.join(modelsDir, model);

  if (!fs.existsSync(filePath)) {
    console.log(`Model ${model} not found. Downloading...`);

    const url = `${BASE_URL}/${model}`;
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
  } else {
    console.log(`Model ${model} already exists.`);
  }
});

console.log("Face detection model check complete.");
