import Pricing from "../models/Pricing.js";
import Branding from "../models/Branding.js";
import Material from "../models/Material.js";
import fs from "fs/promises";
import path from "path";

const getLocalUploadPath = (logoUrl) => {
  if (!logoUrl || typeof logoUrl !== "string") return null;

  let pathname = "";

  try {
    pathname = new URL(logoUrl).pathname;
  } catch {
    pathname = logoUrl;
  }

  if (!pathname.startsWith("/uploads/")) return null;

  const filename = path.basename(pathname);
  if (!filename) return null;

  return path.join(process.cwd(), "uploads", filename);
};

const removeLocalLogoIfExists = async (logoUrl) => {
  const filePath = getLocalUploadPath(logoUrl);
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
};

// PRICING
export const getPricing = async (req, res) => {
  const data = await Pricing.find();
  res.json(data);
};

export const updatePricing = async (req, res) => {
  const { roomType, basic, premium, luxury } = req.body;

  if (!roomType) {
    return res.status(400).json({ msg: "roomType is required" });
  }

  let pricing = await Pricing.findOne({ roomType });

  if (pricing) {
    pricing.basic = basic;
    pricing.premium = premium;
    pricing.luxury = luxury;
    await pricing.save();
  } else {
    pricing = await Pricing.create(req.body);
  }

  res.json(pricing);
};

// BRANDING
export const getBranding = async (req, res) => {
  const data = await Branding.findOne();
  res.json(data);
};

export const getPublicBranding = async (req, res) => {
  const data = await Branding.findOne();
  res.json(data || {});
};

export const updateBranding = async (req, res) => {
  let branding = await Branding.findOne();

  if (branding) {
    const oldLogoUrl = branding.logoUrl;
    Object.assign(branding, req.body);
    await branding.save();

    if (req.body.logoUrl && req.body.logoUrl !== oldLogoUrl) {
      await removeLocalLogoIfExists(oldLogoUrl);
    }
  } else {
    branding = await Branding.create(req.body);
  }

  res.json(branding);
};

export const uploadBrandingLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Logo file is required" });
    }

    const logoUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    let branding = await Branding.findOne();
    if (branding) {
      const oldLogoUrl = branding.logoUrl;
      branding.logoUrl = logoUrl;
      await branding.save();
      await removeLocalLogoIfExists(oldLogoUrl);
    } else {
      branding = await Branding.create({ logoUrl });
    }

    res.json({ logoUrl, branding });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const removeBrandingLogo = async (req, res) => {
  try {
    const branding = await Branding.findOne();

    if (!branding) {
      return res.status(404).json({ msg: "Branding not found" });
    }

    await removeLocalLogoIfExists(branding.logoUrl);
    branding.logoUrl = "";
    await branding.save();

    res.json({ msg: "Logo removed", branding });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// MATERIALS
export const getMaterials = async (req, res) => {
  const data = await Material.find();
  res.json(data);
};

export const updateMaterials = async (req, res) => {
  const { roomType, suggestions } = req.body;

  let material = await Material.findOne({ roomType });

  if (material) {
    material.suggestions = suggestions;
    await material.save();
  } else {
    material = await Material.create(req.body);
  }

  res.json(material);
};
