import express from "express";
import {
  createProject,
  getUserProjects,
  getProjectByShareId,
} from "../controllers/projectController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, createProject);
router.get("/", authMiddleware, getUserProjects);
router.get("/share/:shareId", getProjectByShareId);

export default router;
