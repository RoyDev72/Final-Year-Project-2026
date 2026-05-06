import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema({
  roomType: String, // bedroom, kitchen etc
  basic: Number,
  premium: Number,
  luxury: Number,
 }, {timestamps: true});

export default mongoose.model("Pricing", pricingSchema);