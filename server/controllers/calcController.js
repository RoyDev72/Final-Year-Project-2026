import fs from "fs/promises";
import os from "os";
import path from "path";
import Pricing from "../models/Pricing.js";
import Material from "../models/Material.js";
import {
  normalizeRoomName,
  sanitizeAndCalculateRooms,
} from "../utils/floorPlanPostProcess.js";
import { isPdfFile } from "../utils/ocrHelpers.js";
import { extractTextWithLocalOcr } from "../services/localOcrService.js";

function toDecimalFeet(feet, inches) {
  const f = Number(feet);
  const i = Number(inches || 0);
  if (!Number.isFinite(f) || !Number.isFinite(i)) return null;
  return Math.round((f + i / 12) * 100) / 100;
}

function normalizeFeetInchLine(line) {
  if (!line) return "";

  let normalized = String(line);

  normalized = normalized.replace(
    /(\d+)\s*(?:-|\s)\s*(1\/2|1\/4|3\/4)/g,
    (_m, whole, frac) => {
      const base = Number(whole);
      const fracMap = { "1/2": 0.5, "1/4": 0.25, "3/4": 0.75 };
      const add = fracMap[frac];
      if (!Number.isFinite(base) || add === undefined) return _m;
      return String(Math.round((base + add) * 100) / 100);
    },
  );

  normalized = normalized.replace(
    /(\d+)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:"|”|in)?/g,
    (_m, feet, inches) => String(toDecimalFeet(feet, inches) ?? _m),
  );

  normalized = normalized.replace(
    /(\d+)\s*(?:'|ft|feet)\s*(\d+(?:\.\d+)?)\s*(?:"|”|in)?/gi,
    (_m, feet, inches) => String(toDecimalFeet(feet, inches) ?? _m),
  );

  normalized = normalized.replace(/(\d+)\s*(?:'|ft|feet)\b/gi, (_m, feet) =>
    String(toDecimalFeet(feet, 0) ?? _m),
  );

  return normalized;
}

function getLinesFromOcrResult(ocrResult) {
  if (Array.isArray(ocrResult?.lines) && ocrResult.lines.length) {
    return ocrResult.lines;
  }

  return String(ocrResult?.text || "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeDimensionToken(token, unitHint = "unknown") {
  const value = String(token || "").trim();
  if (!value) return null;

  const cleaned = value.replace(/[^\d.:-]/g, "");
  if (!cleaned) return null;

  const rawNumeric = Number(cleaned);
  if (Number.isFinite(rawNumeric)) {
    if (unitHint === "metric") {
      return Math.round(rawNumeric * 3.28084 * 100) / 100;
    }
    return rawNumeric;
  }

  const split = cleaned.split(/[-:]/);
  if (split.length === 2) {
    const feet = Number(split[0]);
    const second = Number(split[1]);

    if (!Number.isFinite(feet) || !Number.isFinite(second)) {
      return null;
    }

    if (second <= 11) {
      return Math.round((feet + second / 12) * 100) / 100;
    }

    return Number(`${feet}.${split[1]}`);
  }

  if (/^\d{2}$/.test(cleaned)) {
    if (cleaned.endsWith("0")) {
      return Number(cleaned);
    }

    return Number(`${cleaned.slice(0, 1)}.${cleaned.slice(1)}`);
  }

  if (/^\d{3}$/.test(cleaned) || /^\d{4}$/.test(cleaned)) {
    return Number(`${cleaned.slice(0, 2)}.${cleaned.slice(2)}`);
  }

  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;

  if (unitHint === "metric") {
    return Math.round(numeric * 3.28084 * 100) / 100;
  }

  return numeric;
}

function extractDimensionPairs(text) {
  const normalized = normalizeFeetInchLine(text);
  const searchable = normalized.replace(/[°“”"'`]/g, "");
  const pairs = [];
  const patterns = [
    /((?:[\d.:-]+)\s*(?:ft|feet|f)?\s*[x×*]\s*(?:[\d.:-]+))/gi,
    /((?:[\d.:-]+)\s*(?:ft|feet|f)?\s*(?:by|\bx\b)\s*(?:[\d.:-]+))/gi,
  ];

  for (const pattern of patterns) {
    for (const match of searchable.matchAll(pattern)) {
      const segment = String(match[1] || "");
      const parts = segment.split(/[x×*]|\bby\b/i).map((part) => part.trim());
      if (parts.length !== 2) continue;

      const leftRaw = parts[0];
      const rightRaw = parts[1];
      const leftHasFeet = /(?:ft|feet|f|')\b/i.test(leftRaw);
      const rightHasFeet = /(?:ft|feet|f|')\b/i.test(rightRaw);
      const leftHasMeters = /(?:m|meter|metre)\b/i.test(leftRaw);
      const rightHasMeters = /(?:m|meter|metre)\b/i.test(rightRaw);

      const length = normalizeDimensionToken(
        leftRaw.replace(/(?:ft|feet|f|')\b/gi, "").trim(),
        leftHasMeters ? "metric" : leftHasFeet ? "feet" : "unknown",
      );
      const width = normalizeDimensionToken(
        rightRaw.replace(/(?:ft|feet|f|')\b/gi, "").trim(),
        rightHasMeters ? "metric" : rightHasFeet ? "feet" : "unknown",
      );

      if (length !== null && width !== null) {
        pairs.push({ length, width });
      }
    }
  }

  return pairs;
}

function extractRoomMentions(line) {
  const compact = String(line || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) return [];

  const roomHints = [
    "master bedroom",
    "master bed room",
    "master bed",
    "masterbedroom",
    "bed room",
    "bedroom",
    "kitchen",
    "hall",
    "living room",
    "living",
    "lounge",
    "bathroom",
    "washroom",
    "toilet",
    "tolet",
    "toliet",
    "wc",
    "dining",
    "study",
    "balcony",
    "utility",
    "utility room",
    "store",
    "store room",
    "drawing",
    "puja",
    "pooja",
    "passage",
    "lobby",
    "sit out",
    "sitout",
    "porch",
  ];

  const found = [];

  for (const hint of roomHints) {
    if (compact.includes(hint)) {
      const canonical = normalizeRoomName(hint) || normalizeRoomName(line);
      if (canonical && !found.includes(canonical)) {
        found.push(canonical);
      }
    }
  }

  return found;
}

function extractRoomsFromText(text) {
  const lines = Array.isArray(text) ? text : [text];
  const cleanedLines = lines
    .map((line) => String(line || "").trim())
    .filter(Boolean);

  const rawRooms = [];
  let pendingRooms = [];

  for (const line of cleanedLines) {
    const roomMentions = extractRoomMentions(line);
    const dimensions = extractDimensionPairs(line);

    if (roomMentions.length && dimensions.length) {
      const pairCount = Math.min(roomMentions.length, dimensions.length);

      for (let index = 0; index < pairCount; index += 1) {
        rawRooms.push({
          room: roomMentions[index],
          length: dimensions[index].length,
          width: dimensions[index].width,
        });
      }

      if (roomMentions.length > pairCount) {
        pendingRooms.push(...roomMentions.slice(pairCount));
      }

      continue;
    }

    if (roomMentions.length) {
      pendingRooms.push(...roomMentions);
      continue;
    }

    if (pendingRooms.length && dimensions.length) {
      const pairCount = Math.min(pendingRooms.length, dimensions.length);

      for (let index = 0; index < pairCount; index += 1) {
        rawRooms.push({
          room: pendingRooms[index],
          length: dimensions[index].length,
          width: dimensions[index].width,
        });
      }

      pendingRooms = pendingRooms.slice(pairCount);
    }
  }

  return rawRooms;
}

export const analyzeFloorPlan = async (req, res) => {
  let tempFilePath = "";

  const fallbackResponse = (message) => ({
    rooms: [],
    total_cost: 0,
    rate_per_sqft: Number(req.body?.rate_per_sqft) || 1500,
    notes:
      message ||
      "No OCR result available right now. Add rooms manually to continue.",
  });

  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        msg: "Please upload a floor plan file.",
      });
    }

    const tempFileName = `floorplan-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(req.file.originalname || "") || ".png"}`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);

    await fs.writeFile(tempFilePath, req.file.buffer);

    const ocrResult = await extractTextWithLocalOcr({
      filePath: tempFilePath,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    if (!ocrResult.text.trim()) {
      return res.json(fallbackResponse());
    }

    const lines = getLinesFromOcrResult(ocrResult);
    const rawRooms = extractRoomsFromText(lines);
    const cleaned = sanitizeAndCalculateRooms(
      rawRooms,
      req.body?.rate_per_sqft,
    );

    const result = {
      rooms: cleaned.rooms.map((room) => ({
        label: room.room,
        roomType: room.room,
        length: room.length,
        width: room.width,
        area: room.area,
      })),
      total_cost: cleaned.total_cost,
      rate_per_sqft: cleaned.rate_per_sqft,
      notes: rawRooms.length
        ? "Floor plan analysis complete. Review detected spaces and continue."
        : "No rooms detected. Add spaces manually from the table.",
    };

    if (String(req.query?.debug || "") === "1") {
      result.ocr_debug = {
        text: ocrResult.text,
        lines,
      };
    }

    return res.json(result);
  } catch (error) {
    console.error("Floor plan analysis fallback:", error.message);
    const fileName = req.file?.originalname || "";
    const mimeType = req.file?.mimetype || "";
    const isPdf = isPdfFile(mimeType, fileName);
    const userMessage = isPdf
      ? "PDF OCR failed on this machine. Export the plan to PNG or JPG and try again."
      : "OCR is unavailable right now. Add rooms manually to continue.";
    return res.json(fallbackResponse(userMessage));
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }
  }
};

export const calculateCost = async (req, res) => {
  try {
    const { rooms, planType, addOns } = req.body;

    let totalCost = 0;
    let breakdown = [];

    for (let room of rooms) {
      const pricing = await Pricing.findOne({ roomType: room.roomType });

      if (!pricing) {
        return res.status(400).json({
          msg: `Pricing not found for ${room.roomType}`,
        });
      }

      // PLAN RATE
      let rate;
      if (planType === "basic") rate = pricing.basic;
      else if (planType === "premium") rate = pricing.premium;
      else if (planType === "luxury") rate = pricing.luxury;

      let baseCost = room.area * rate;

      // 🪑 MATERIAL COST
      const materialData = await Material.findOne({
        roomType: room.roomType,
      });

      let materialCost = materialData ? room.area * 200 : 0;

      // ⚡ ADD-ONS
      let addOnCost = 0;

      if (addOns?.falseCeiling) {
        addOnCost += room.area * 150;
      }

      if (addOns?.wardrobe && room.roomType === "bedroom") {
        addOnCost += 50000;
      }

      if (addOns?.lighting) {
        addOnCost += room.area * 100;
      }

      // ROOM TOTAL
      const roomTotal = baseCost + materialCost + addOnCost;

      totalCost += roomTotal;

      breakdown.push({
        roomType: room.roomType,
        area: room.area,
        baseCost,
        materialCost,
        addOnCost,
        total: roomTotal,
      });
    }

    res.json({
      totalCost,
      breakdown,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const DEFAULT_PRICING = {
  bedroom: { basic: 900, premium: 1400, luxury: 2200 },
  bathroom: { basic: 1200, premium: 1800, luxury: 2800 },
  kitchen: { basic: 1400, premium: 2200, luxury: 3400 },
  "living room": { basic: 800, premium: 1300, luxury: 2100 },
  dining: { basic: 800, premium: 1300, luxury: 2100 },
  balcony: { basic: 450, premium: 750, luxury: 1200 },
  study: { basic: 750, premium: 1200, luxury: 1900 },
  utility: { basic: 500, premium: 850, luxury: 1300 },
};

const DEFAULT_MATERIAL_RATE = {
  bedroom: 250,
  bathroom: 350,
  kitchen: 500,
  "living room": 220,
  dining: 220,
  balcony: 120,
  study: 200,
  utility: 180,
};

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export const calculateCostV2 = async (req, res) => {
  try {
    const { rooms, planType, addOns } = req.body;
    const safeRooms = Array.isArray(rooms) ? rooms : [];
    const safePlanType = ["basic", "premium", "luxury"].includes(planType)
      ? planType
      : "premium";

    let totalCost = 0;
    const breakdown = [];

    for (const room of safeRooms) {
      const roomType = String(room.roomType || "").trim().toLowerCase();
      const requestedArea = Number(room.areaSqft ?? room.area);
      const area = Number.isFinite(requestedArea)
        ? Math.round(requestedArea * 100) / 100
        : 0;

      if (!roomType) {
        return res.status(400).json({ msg: "Room type is required." });
      }

      if (area <= 0) {
        return res.status(400).json({ msg: `Invalid area for ${roomType}` });
      }

      const dbPricing = await Pricing.findOne({ roomType }).lean();
      const dbRate = Number(dbPricing?.[safePlanType]);
      const pricing =
        Number.isFinite(dbRate) && dbRate >= 100
          ? dbPricing
          : DEFAULT_PRICING[roomType];

      if (!pricing) {
        return res.status(400).json({
          msg: `Pricing not found for ${roomType}`,
        });
      }

      const rate = Number(pricing[safePlanType]);
      if (!Number.isFinite(rate) || rate <= 0) {
        return res.status(400).json({
          msg: `Invalid ${safePlanType} pricing for ${roomType}`,
        });
      }

      const materialData = await Material.findOne({ roomType }).lean();
      const materialRate = materialData
        ? Number(materialData.ratePerSqft) || DEFAULT_MATERIAL_RATE[roomType] || 0
        : DEFAULT_MATERIAL_RATE[roomType] || 0;

      const baseCost = area * rate;
      const materialCost = area * materialRate;
      let addOnCost = 0;

      if (addOns?.falseCeiling) {
        addOnCost += area * 150;
      }

      if (addOns?.wardrobe && roomType === "bedroom") {
        addOnCost += 50000;
      }

      if (addOns?.lighting) {
        addOnCost += area * 100;
      }

      const roomTotal = baseCost + materialCost + addOnCost;
      totalCost += roomTotal;

      breakdown.push({
        roomType,
        area,
        rate,
        materialRate,
        baseCost: roundMoney(baseCost),
        materialCost: roundMoney(materialCost),
        addOnCost: roundMoney(addOnCost),
        total: roundMoney(roomTotal),
      });
    }

    res.json({
      totalCost: roundMoney(totalCost),
      breakdown,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
