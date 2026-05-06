import FloorPlanResult from "../models/FloorPlanResult.js";
import { preprocessFloorPlanBuffer } from "../utils/imagePreprocess.js";
import { parseRoomsFromOcr } from "../utils/roomParser.js";
import { runPaddleOcr } from "../services/ocrMicroservice.js";

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export async function uploadFloorPlan(req, res, next) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const mimeType = String(file.mimetype || "").toLowerCase();
    if (!ACCEPTED_TYPES.has(mimeType)) {
      return res.status(400).json({ message: "Unsupported file type." });
    }

    const processedBuffer = await preprocessFloorPlanBuffer({
      buffer: file.buffer,
      mimeType,
      originalName: file.originalname,
    });

    const ocrResult = await runPaddleOcr({
      imageBuffer: processedBuffer,
      filename: file.originalname,
      mimeType: "image/png",
    });

    console.log("OCR result:", {
      linesCount: ocrResult.lines?.length,
      hasRawText: !!ocrResult.rawText,
    });

    const rooms = parseRoomsFromOcr(ocrResult);
    console.log("Parsed rooms:", rooms.length);

    const totalArea = rooms.reduce(
      (sum, room) => sum + (Number(room.area) || 0),
      0,
    );

    const record = await FloorPlanResult.create({
      originalName: file.originalname,
      mimeType,
      rooms,
      totalArea: Math.round(totalArea * 100) / 100,
      rawText: ocrResult.rawText,
      lines: ocrResult.lines,
    });

    return res.status(200).json({
      id: record._id,
      rooms: record.rooms,
      totalArea: record.totalArea,
    });
  } catch (error) {
    console.error("Upload error:", error.message, error.stack);
    return next(error);
  }
}

export async function getFloorPlanResult(req, res, next) {
  try {
    const { id } = req.params;
    const result = await FloorPlanResult.findById(id).lean();

    if (!result) {
      return res.status(404).json({ message: "Result not found." });
    }

    return res.status(200).json({
      id: result._id,
      rooms: result.rooms,
      totalArea: result.totalArea,
      rawText: result.rawText,
      lines: result.lines,
    });
  } catch (error) {
    return next(error);
  }
}
