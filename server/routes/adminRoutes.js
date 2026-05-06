import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

import {
  getPricing,
  updatePricing,
  getBranding,
  getPublicBranding,
  updateBranding,
  uploadBrandingLogo,
  removeBrandingLogo,
  getMaterials,
  updateMaterials,
} from "../controllers/adminController.js";

const router = express.Router();

router.get("/branding/public", getPublicBranding);

// PRICING
router.get("/pricing", authMiddleware, adminMiddleware, getPricing);
router.put("/pricing", authMiddleware, adminMiddleware, updatePricing);

// BRANDING
router.get("/branding", authMiddleware, adminMiddleware, getBranding);
router.put("/branding", authMiddleware, adminMiddleware, updateBranding);
router.post(
  "/branding/logo",
  authMiddleware,
  adminMiddleware,
  upload.single("logo"),
  uploadBrandingLogo,
);
router.delete(
  "/branding/logo",
  authMiddleware,
  adminMiddleware,
  removeBrandingLogo,
);

// MATERIALS
router.get("/materials", authMiddleware, adminMiddleware, getMaterials);
router.put("/materials", authMiddleware, adminMiddleware, updateMaterials);

export default router;
