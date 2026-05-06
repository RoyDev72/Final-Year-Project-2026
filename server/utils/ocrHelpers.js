import fs from "fs/promises";
import sharp from "sharp";

export function isPdfFile(mimeType, fileName = "") {
  return (
    mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")
  );
}

async function tryOpenCvPreprocess(inputBuffer) {
  try {
    const cv = await import("opencv4nodejs");
    const image = cv.default.imdecode(inputBuffer);
    const gray = image.bgrToGray();
    const denoised = gray.gaussianBlur(new cv.default.Size(3, 3), 0);
    const thresholded = denoised.threshold(
      0,
      255,
      cv.default.THRESH_BINARY + cv.default.THRESH_OTSU,
    );
    return cv.default.imencode(".png", thresholded);
  } catch (_error) {
    return null;
  }
}

export async function preprocessImageForOcr(filePath, mimeType) {
  const sourceBuffer = await fs.readFile(filePath);

  if (!mimeType?.startsWith("image/")) {
    return sourceBuffer;
  }

  if (process.env.USE_OPENCV === "true") {
    const cvResult = await tryOpenCvPreprocess(sourceBuffer);
    if (cvResult) {
      return cvResult;
    }
  }

  // Sharp fallback keeps preprocessing available even when OpenCV is not installed.
  try {
    return await sharp(sourceBuffer)
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
  } catch (_error) {
    return sourceBuffer;
  }
}
