import express from "express";
import multer from "multer";
import {
  analyzeFloorPlan,
  calculateCostV2 as calculateCost,
} from "../controllers/calcController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ]);

    if (allowed.has((file.mimetype || "").toLowerCase())) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported file type. Use PDF, JPEG, PNG, or WEBP."), false);
  },
});

const analyzeUpload = (req, res, next) => {
  upload.single("floorPlan")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    res.status(400).json({
      msg: err.message || "Invalid upload request.",
    });
  });
};

router.post("/analyze", analyzeUpload, analyzeFloorPlan);
router.post("/calculate", calculateCost);

export default router;
