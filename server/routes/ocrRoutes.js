import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { extractTextWithLocalOcr } from "../services/localOcrService.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Endpoint: POST /api/ocr/paddle
// Accepts a multipart/form-data file field named 'image'.
// Runs local OCR and returns the extracted text.
router.post("/paddle", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const imagePath = path.resolve(req.file.path);

    const ocrResult = await extractTextWithLocalOcr({
      filePath: imagePath,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    return res.json({ text: ocrResult.text, lines: ocrResult.lines });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
  }
});

// Informational endpoint for OpenCV availability
router.get("/opencv-status", async (_req, res) => {
  try {
    return res.json({
      ocr: true,
      note: "Local OCR is enabled with Tesseract.js",
      engine: "tesseract.js",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error checking OCR status", detail: error.message });
  }
});

export default router;
