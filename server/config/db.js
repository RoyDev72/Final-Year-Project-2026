import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGO_URI?.trim();

  if (!uri || uri === "your_mongodb_connection") {
    throw new Error("MongoDB not connected: set a valid MONGO_URI in .env");
  }

  const isValidScheme =
    uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");

  if (!isValidScheme) {
    throw new Error(
      "MongoDB not connected: MONGO_URI must start with mongodb:// or mongodb+srv://",
    );
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("MongoDB Connected");
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
};

export default connectDB;
