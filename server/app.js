import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import connectDB from "./config/db.js";
import projectRoutes from "./routes/projectRoutes.js";
import dotenv from "dotenv";
import adminRoutes from "./routes/adminRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import floorPlanRoutes from "./routes/floorPlanRoutes.js";
import ocrRoutes from "./routes/ocrRoutes.js";

dotenv.config({ override: true });

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("API Running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/floorplan", floorPlanRoutes);
app.use("/api/ocr", ocrRoutes);
// AI routes removed
// background job routes and worker removed

// Global error handler to keep API failures structured.
app.use((err, _req, res, _next) => {
  console.error("Global error handler:", err.message, err.stack);
  const status = err?.status || 500;
  res.status(status).json({
    message: err?.message || "Internal server error",
  });
});

export default app;
