import { createRequire } from "module";
import fs from "fs/promises";
import path from "path";
import process from "process";

const require = createRequire(import.meta.url);
const vision = require("@google-cloud/vision");

function buildVisionClient() {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error(
      "Missing GOOGLE_APPLICATION_CREDENTIALS. Set it to your service-account JSON file path."
    );
  }

  return new vision.ImageAnnotatorClient({ keyFilename: keyFile });
}

function resolveInputPath() {
  const providedPath = process.argv[2];
  if (providedPath) {
    return path.resolve(providedPath);
  }

  return path.resolve("./uploads/test.png");
}

async function test() {
  const client = buildVisionClient();
  const inputPath = resolveInputPath();

  try {
    await fs.access(inputPath);
  } catch (_error) {
    throw new Error(
      `Image not found at ${inputPath}. Pass a path like: node testVision.js ./uploads/w24-page1.png`
    );
  }

  const [result] = await client.textDetection(inputPath);
  console.log(result.fullTextAnnotation?.text || "No text detected");
}

test().catch((error) => {
  console.error("Vision API test failed:", error.message);
  process.exitCode = 1;
});
