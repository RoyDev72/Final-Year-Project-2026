import fs from "fs/promises";
import vision from "@google-cloud/vision";
import { GoogleGenAI } from "@google/genai";
import { isPdfFile, preprocessImageForOcr } from "../utils/ocrHelpers.js";
import { sanitizeAndCalculateRooms } from "../utils/floorPlanPostProcess.js";

let latestResult = null;

function buildVisionClient() {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS_JSON);
    return new vision.ImageAnnotatorClient({ credentials });
  }

  return new vision.ImageAnnotatorClient();
}

function extractJsonArray(textResponse) {
  if (!textResponse || typeof textResponse !== "string") {
    return [];
  }

  const fencedMatch = textResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonCandidate = fencedMatch ? fencedMatch[1] : textResponse;

  const firstBracket = jsonCandidate.indexOf("[");
  const lastBracket = jsonCandidate.lastIndexOf("]");
  if (
    firstBracket === -1 ||
    lastBracket === -1 ||
    lastBracket <= firstBracket
  ) {
    return [];
  }

  const trimmed = jsonCandidate.slice(firstBracket, lastBracket + 1);

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

async function extractTextWithVision({ filePath, mimeType, originalName }) {
  const client = buildVisionClient();

  if (isPdfFile(mimeType, originalName)) {
    const pdfBuffer = await fs.readFile(filePath);
    const [result] = await client.batchAnnotateFiles({
      requests: [
        {
          inputConfig: {
            content: pdfBuffer,
            mimeType: "application/pdf",
          },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: [1],
        },
      ],
    });

    return (
      result?.responses?.[0]?.responses?.[0]?.fullTextAnnotation?.text ?? ""
    );
  }

  const processedImage = await preprocessImageForOcr(filePath, mimeType);
  const [result] = await client.documentTextDetection({
    image: { content: processedImage },
  });

  return (
    result?.fullTextAnnotation?.text ??
    result?.textAnnotations?.[0]?.description ??
    ""
  );
}

async function extractRoomsWithGemini(ocrText) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `You are an expert in architectural floor plans.
Extract only valid rooms (Bedroom, Kitchen, Hall, Bathroom, etc).
Fix OCR errors (like l0 -> 10).
Extract dimensions in format length x width (feet).
Ignore noise and duplicates.
Return strict JSON:
[{ "room": "", "length": number, "width": number }]

OCR text:
${ocrText}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return extractJsonArray(response?.text ?? "");
}

export async function analyzeFloorPlan({
  filePath,
  mimeType,
  originalName,
  ratePerSqft,
}) {
  if (!filePath) {
    throw new Error("Uploaded file path is missing");
  }

  const ocrText = await extractTextWithVision({
    filePath,
    mimeType,
    originalName,
  });
  if (!ocrText.trim()) {
    throw new Error("No text could be extracted from the uploaded floor plan");
  }

  const rawRooms = await extractRoomsWithGemini(ocrText);
  const result = sanitizeAndCalculateRooms(rawRooms, ratePerSqft);

  latestResult = {
    ...result,
    extracted_text: ocrText,
    analyzed_at: new Date().toISOString(),
  };

  return latestResult;
}

export function getLatestFloorPlanResult() {
  return latestResult;
}
