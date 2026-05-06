import express from "express";
import multer from "multer";
import {
  getFloorPlanResult,
  uploadFloorPlan,
} from "../controllers/floorPlanController.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.post("/upload", upload.single("file"), uploadFloorPlan);
router.get("/result/:id", getFloorPlanResult);

export default router;
