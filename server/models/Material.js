import mongoose from "mongoose";

const materialSchema = new mongoose.Schema({
  roomType: String,
  suggestions: [String],
});

export default mongoose.model("Material", materialSchema);