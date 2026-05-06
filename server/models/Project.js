import mongoose from "mongoose";
import crypto from "crypto";

const projectSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  shareId: {
    type: String,
    default: () => crypto.randomUUID(),
  },
  projectName: String,
  imageUrl: String,
  rooms: [
    {
      name: String,
      length: Number,
      width: Number,
      area: Number,
      cost: Number,
    },
  ],
  totalCost: Number,
  report: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Project", projectSchema);
