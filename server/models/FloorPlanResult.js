import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    area: { type: Number, required: true },
    rawText: { type: String, default: "" },
  },
  { _id: false },
);

const floorPlanResultSchema = new mongoose.Schema(
  {
    originalName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    rooms: { type: [roomSchema], default: [] },
    totalArea: { type: Number, default: 0 },
    rawText: { type: String, default: "" },
    lines: { type: [String], default: [] },
  },
  { timestamps: true },
);

const FloorPlanResult = mongoose.model(
  "FloorPlanResult",
  floorPlanResultSchema,
);

export default FloorPlanResult;
