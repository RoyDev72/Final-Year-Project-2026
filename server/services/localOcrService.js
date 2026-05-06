import fs from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import tesseract from "tesseract.js";
import { isPdfFile, preprocessImageForOcr } from "../utils/ocrHelpers.js";

async function rasterizePdf(filePath) {
  const pdfBuffer = await fs.readFile(filePath);

  return sharp(pdfBuffer, { density: 320, page: 0 }).png().toBuffer();
}

async function toOcrInputBuffer(filePath, mimeType, originalName) {
  if (isPdfFile(mimeType, originalName)) {
    return rasterizePdf(filePath);
  }

  return preprocessImageForOcr(filePath, mimeType);
}

async function enhanceImageForOcr(inputBuffer) {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const scale = width && width < 2000 ? 1.6 : 1.2;

  return image
    .resize({
      width: width ? Math.round(width * scale) : undefined,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(160)
    .png()
    .toBuffer();
}

async function softenImageForOcr(inputBuffer) {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const scale = width && width < 2000 ? 1.4 : 1.15;

  return image
    .resize({
      width: width ? Math.round(width * scale) : undefined,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

async function runTesseract(imagePath) {
  const { data } = await tesseract.recognize(imagePath, "eng", {
    logger: () => undefined,
    cachePath: path.join(process.cwd(), ".tesseract-cache"),
    tessedit_pageseg_mode: "6",
  });

  return {
    text: data?.text ?? "",
    lines: Array.isArray(data?.lines)
      ? data.lines.map((line) => line?.text).filter(Boolean)
      : [],
  };
}

export async function extractTextWithLocalOcr({
  filePath,
  mimeType,
  originalName,
}) {
  const inputBuffer = await toOcrInputBuffer(filePath, mimeType, originalName);
  const enhancedBuffer = await enhanceImageForOcr(inputBuffer);
  const softenedBuffer = await softenImageForOcr(inputBuffer);
  const tempImagePath = path.join(
    os.tmpdir(),
    `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  );
  const tempSoftPath = path.join(
    os.tmpdir(),
    `ocr-soft-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  );

  await fs.writeFile(tempImagePath, enhancedBuffer);
  await fs.writeFile(tempSoftPath, softenedBuffer);

  try {
    const [primary, secondary] = await Promise.all([
      runTesseract(tempImagePath),
      runTesseract(tempSoftPath),
    ]);

    const mergedLines = new Map();
    [...primary.lines, ...secondary.lines]
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .forEach((line) => {
        const key = line.toLowerCase();
        if (!mergedLines.has(key)) {
          mergedLines.set(key, line);
        }
      });

    const mergedText = [primary.text, secondary.text]
      .map((chunk) => String(chunk || "").trim())
      .filter(Boolean)
      .join("\n");

    return {
      text: mergedText,
      lines: Array.from(mergedLines.values()),
    };
  } finally {
    await fs.unlink(tempImagePath).catch(() => undefined);
    await fs.unlink(tempSoftPath).catch(() => undefined);
  }
}
