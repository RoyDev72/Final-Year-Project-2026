import sharp from "sharp";
import { isPdfFile } from "./ocrHelpers.js";

const DEFAULT_MAX_WIDTH = 2600;

async function rasterizePdfToPng(buffer) {
  return sharp(buffer, { density: 320, page: 0 }).png().toBuffer();
}

function getTargetWidth(width) {
  if (!width || width <= 0) return DEFAULT_MAX_WIDTH;
  if (width >= DEFAULT_MAX_WIDTH) return DEFAULT_MAX_WIDTH;
  return Math.max(Math.round(width * 1.4), Math.min(DEFAULT_MAX_WIDTH, 1800));
}

export async function preprocessFloorPlanBuffer({
  buffer,
  mimeType,
  originalName,
}) {
  if (!buffer) {
    throw new Error("Missing input buffer for preprocessing");
  }

  const source = isPdfFile(mimeType, originalName)
    ? await rasterizePdfToPng(buffer)
    : buffer;

  const image = sharp(source);
  const metadata = await image.metadata();
  const targetWidth = getTargetWidth(metadata.width);

  return image
    .resize({
      width: targetWidth,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(160)
    .png()
    .toBuffer();
}
