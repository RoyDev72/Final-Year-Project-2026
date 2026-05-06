import mongoose from "mongoose";

const brandingSchema = new mongoose.Schema({
  companyName: String,
  logoUrl: String,
  primaryColor: String,
  secondaryColor: String,
  footerText: String,
});

export default mongoose.model("Branding", brandingSchema);