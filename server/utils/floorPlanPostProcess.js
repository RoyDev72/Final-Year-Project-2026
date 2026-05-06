const VALID_ROOM_NAMES = new Set([
  "Bedroom",
  "Kitchen",
  "Hall",
  "Bathroom",
  "Living Room",
  "Dining Room",
  "Study Room",
  "Balcony",
  "Store Room",
  "Utility Room",
  "Toilet",
  "Drawing Room",
  "Puja Room",
  "Passage",
  "Lobby",
]);

const ROOM_NAME_ALIASES = {
  bed: "Bedroom",
  bedroom: "Bedroom",
  bedrm: "Bedroom",
  masterbed: "Bedroom",
  masterbedroom: "Bedroom",
  masterbr: "Bedroom",
  kitchen: "Kitchen",
  kit: "Kitchen",
  hall: "Hall",
  living: "Living Room",
  livingroom: "Living Room",
  lounge: "Living Room",
  bath: "Bathroom",
  bathroom: "Bathroom",
  washroom: "Bathroom",
  toilet: "Toilet",
  wc: "Toilet",
  dining: "Dining Room",
  study: "Study Room",
  balcony: "Balcony",
  sitout: "Balcony",
  porch: "Balcony",
  store: "Store Room",
  storeroom: "Store Room",
  utility: "Utility Room",
  utilityroom: "Utility Room",
  drawing: "Drawing Room",
  drawingroom: "Drawing Room",
  puja: "Puja Room",
  pooja: "Puja Room",
  passage: "Passage",
  lobby: "Lobby",
};

export function normalizeRoomName(rawRoomName) {
  if (!rawRoomName || typeof rawRoomName !== "string") {
    return "";
  }

  const compact = rawRoomName.toLowerCase().replace(/[^a-z]/g, "");
  if (!compact) {
    return "";
  }

  if (ROOM_NAME_ALIASES[compact]) {
    return ROOM_NAME_ALIASES[compact];
  }

  for (const [alias, canonical] of Object.entries(ROOM_NAME_ALIASES)) {
    if (compact.includes(alias)) {
      return canonical;
    }
  }

  return "";
}

function hasTwoDecimalDigits(value) {
  const fraction = Math.abs(value % 1);
  if (fraction === 0) return false;
  const oneDecimal = Math.round(fraction * 10) / 10;
  return Math.abs(fraction - oneDecimal) > 1e-6;
}

function normalizeDimension(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const rounded = Math.round(numeric * 100) / 100;
  if (rounded < 3 || rounded > 50) {
    return null;
  }

  return rounded;
}

function normalizeDimensionPair(length, width) {
  const len = Number(length);
  const wid = Number(width);
  if (!Number.isFinite(len) || !Number.isFinite(wid)) {
    return null;
  }

  const max = Math.max(len, wid);
  const min = Math.min(len, wid);
  const looksMetric =
    max <= 6 &&
    min <= 3.5 &&
    (hasTwoDecimalDigits(len) || hasTwoDecimalDigits(wid));

  const scaledLen = looksMetric ? len * 3.28084 : len;
  const scaledWid = looksMetric ? wid * 3.28084 : wid;

  const normLen = normalizeDimension(scaledLen);
  const normWid = normalizeDimension(scaledWid);

  if (normLen === null || normWid === null) {
    return null;
  }

  return { length: normLen, width: normWid };
}

function dedupeKey(room, length, width) {
  const ordered = [length, width].sort((a, b) => a - b);
  return `${room}-${ordered[0]}-${ordered[1]}`;
}

export function sanitizeAndCalculateRooms(rawRooms, ratePerSqft = 1500) {
  const incoming = Array.isArray(rawRooms) ? rawRooms : [];
  const cleanedRooms = [];
  const seen = new Set();

  for (const item of incoming) {
    const room = normalizeRoomName(item?.room);
    const normalized = normalizeDimensionPair(item?.length, item?.width);
    const length = normalized?.length ?? null;
    const width = normalized?.width ?? null;

    if (!room || length === null || width === null) {
      continue;
    }

    if (!VALID_ROOM_NAMES.has(room)) {
      continue;
    }

    const key = dedupeKey(room, length, width);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const area = Math.round(length * width * 100) / 100;
    cleanedRooms.push({ room, length, width, area });
  }

  const numericRate = Number(ratePerSqft);
  const safeRate =
    Number.isFinite(numericRate) && numericRate > 0 ? numericRate : 1500;
  const totalArea = cleanedRooms.reduce((sum, room) => sum + room.area, 0);
  const totalCost = Math.round(totalArea * safeRate * 100) / 100;

  return {
    rooms: cleanedRooms,
    total_cost: totalCost,
    rate_per_sqft: safeRate,
  };
}
