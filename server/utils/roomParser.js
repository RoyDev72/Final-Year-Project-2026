const ROOM_TYPES = [
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Living Room",
  "Balcony",
  "Dining",
  "Utility",
  "Toilet",
];

const ROOM_ALIASES = {
  "bed room": "Bedroom",
  bedroom: "Bedroom",
  bed: "Bedroom",
  "master bed": "Bedroom",
  "master bedroom": "Bedroom",
  "master bed room": "Bedroom",
  master: "Bedroom",
  kitchen: "Kitchen",
  kitcnen: "Kitchen",
  hall: "Living Room",
  "living room": "Living Room",
  "drawing room": "Living Room",
  "drawing hall": "Living Room",
  lounge: "Living Room",
  bathroom: "Bathroom",
  washroom: "Bathroom",
  "wash room": "Bathroom",
  wc: "Bathroom",
  toilet: "Toilet",
  dining: "Dining",
  "dining room": "Dining",
  utility: "Utility",
  "utility room": "Utility",
  balcony: "Balcony",
  sitout: "Balcony",
  "sit out": "Balcony",
  porch: "Balcony",
};

function compactText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const s = a || "";
  const t = b || "";
  const dp = Array.from({ length: s.length + 1 }, () =>
    new Array(t.length + 1).fill(0),
  );

  for (let i = 0; i <= s.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[s.length][t.length];
}

function normalizeRoomLabel(value) {
  const compact = compactText(value);
  if (!compact) return "";

  if (/^[wdmv]\s*\d*$/i.test(compact) || /^[wdmv]\d+\s*[a-z]?$/i.test(compact)) {
    return "";
  }
  if (/^[dw]\d+\s*\//i.test(compact)) {
    return "";
  }

  const parts = compact
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (ROOM_ALIASES[part]) return ROOM_ALIASES[part];
    for (const [alias, canonical] of Object.entries(ROOM_ALIASES)) {
      if (part.includes(alias)) return canonical;
    }
  }

  if (ROOM_ALIASES[compact]) return ROOM_ALIASES[compact];

  for (const [alias, canonical] of Object.entries(ROOM_ALIASES)) {
    if (compact.includes(alias)) return canonical;
  }

  let best = "";
  let bestScore = Infinity;

  for (const alias of Object.keys(ROOM_ALIASES)) {
    const score = levenshtein(compact, alias);
    if (score < bestScore) {
      bestScore = score;
      best = alias;
    }
  }

  const fuzzyAllowed =
    compact.length >= 4 && bestScore <= Math.max(1, Math.floor(compact.length / 4));
  return best && fuzzyAllowed ? ROOM_ALIASES[best] : "";
}

function normalizeDimensionText(value) {
  return String(value || "")
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/½/g, " 1/2")
    .replace(/[oO]/g, "0")
    .replace(/[~]/g, '"')
    .trim();
}

function parseFeetInchesSide(value) {
  const text = normalizeDimensionText(value);
  const match = text.match(/(\d+)\s*'\s*-?\s*(\d+)?(?:\s+(\d+)\s*\/\s*(\d+))?/);
  if (!match) return null;

  const feet = Number(match[1]);
  let inchText = match[2] || "0";
  let fractionTop = match[3] === undefined ? 0 : Number(match[3]);
  let fractionBottom = match[4] === undefined ? 1 : Number(match[4]);

  // PaddleOCR often reads half-inch marks as a trailing 1:
  // 14'-4 1/2" -> 14'-41", 12'-9 1/2" -> 12'-91".
  if (
    match[3] === undefined &&
    /^\d{2}$/.test(inchText) &&
    inchText.endsWith("1") &&
    Number(inchText) > 11
  ) {
    inchText = inchText.slice(0, -1);
    fractionTop = 1;
    fractionBottom = 2;
  }

  const inches = Number(inchText);
  if (
    !Number.isFinite(feet) ||
    !Number.isFinite(inches) ||
    !Number.isFinite(fractionTop) ||
    !Number.isFinite(fractionBottom) ||
    fractionBottom === 0 ||
    inches >= 12
  ) {
    return null;
  }

  return feet + (inches + fractionTop / fractionBottom) / 12;
}

function extractDimensionPairs(text) {
  const cleaned = normalizeDimensionText(text).replace(/[×]/g, "x");
  const pairs = [];
  const pairMatch = cleaned.match(/(.+?)\s*x\s*(.+)/i);

  if (pairMatch) {
    const leftFeet = parseFeetInchesSide(pairMatch[1]);
    const rightFeet = parseFeetInchesSide(pairMatch[2]);
    if (leftFeet !== null && rightFeet !== null) {
      const length = Math.round(leftFeet * 0.3048 * 100) / 100;
      const width = Math.round(rightFeet * 0.3048 * 100) / 100;
      if (length > 0 && width > 0) pairs.push({ length, width });
      return pairs;
    }
  }

  const decimalPattern = /(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/gi;
  for (const match of cleaned.matchAll(decimalPattern)) {
    const length = Number(match[1]);
    const width = Number(match[2]);
    if (
      Number.isFinite(length) &&
      Number.isFinite(width) &&
      length > 0 &&
      width > 0
    ) {
      pairs.push({ length, width });
    }
  }

  return pairs;
}

function cleanOcrLine(line) {
  return String(line || "")
    .replace(/\bO\b/gi, "0")
    .replace(/\bl\b/gi, "1")
    .replace(/\bI\b/gi, "1")
    .replace(/\s+/g, " ")
    .trim();
}

function getBoxMetrics(box) {
  if (!Array.isArray(box) || box.length < 4) return null;
  const points = box
    .map((point) =>
      Array.isArray(point) && point.length >= 2
        ? { x: Number(point[0]), y: Number(point[1]) }
        : null,
    )
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y));

  if (points.length < 4) return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    left,
    right,
    top,
    bottom,
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
  };
}

function normalizeOcrItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const text = cleanOcrLine(item?.text);
      const box = getBoxMetrics(item?.box);
      return text && box ? { ...box, index, text } : null;
    })
    .filter(Boolean);
}

function isLikelyPlanNoise(text) {
  const compact = compactText(text);
  return (
    compact.includes("built up area") ||
    compact.includes("facing building") ||
    compact.includes("proposed") ||
    compact.includes("indianplans") ||
    compact.includes("www") ||
    compact === "n"
  );
}

function parseRoomsFromPositionedItems(items) {
  const positioned = normalizeOcrItems(items).filter(
    (item) => !isLikelyPlanNoise(item.text),
  );
  if (!positioned.length) return [];

  const roomItems = positioned
    .map((item) => ({ ...item, roomLabel: normalizeRoomLabel(item.text) }))
    .filter((item) => item.roomLabel);

  const dimensionItems = positioned
    .map((item) => ({ ...item, pairs: extractDimensionPairs(item.text) }))
    .filter((item) => item.pairs.length);

  if (!roomItems.length || !dimensionItems.length) return [];

  const usedDimensions = new Set();
  const rooms = [];

  for (const room of roomItems) {
    let best = null;

    for (const dimension of dimensionItems) {
      if (usedDimensions.has(dimension.index)) continue;

      const dx = Math.abs(dimension.cx - room.cx);
      const dy = dimension.cy - room.cy;
      const absoluteDy = Math.abs(dy);

      if (
        dx > Math.max(280, room.width * 5) ||
        absoluteDy > Math.max(170, room.height * 8)
      ) {
        continue;
      }

      let score = dx * 0.75 + absoluteDy;
      if (dy < -25) score += 160;
      if (dy > 120) score += 80;
      if (dx > 140) score += 80;

      if (!best || score < best.score) {
        best = { dimension, score };
      }
    }

    if (!best) continue;

    usedDimensions.add(best.dimension.index);
    for (const pair of best.dimension.pairs) {
      rooms.push({
        type: room.roomLabel,
        length: pair.length,
        width: pair.width,
        area: Math.round(pair.length * pair.width * 100) / 100,
        rawText: best.dimension.text,
        sourceX: Math.round(room.cx),
        sourceY: Math.round(room.cy),
      });
    }
  }

  const seen = new Set();
  return rooms
    .filter((room) => ROOM_TYPES.includes(room.type))
    .filter((room) => {
      const dimensions = [room.length, room.width].sort((a, b) => a - b);
      const key = `${room.type}-${dimensions[0]}-${dimensions[1]}-${room.sourceX}-${room.sourceY}`;
      if (seen.has(key)) return false;
      seen.add(key);
      delete room.sourceX;
      delete room.sourceY;
      return true;
    });
}

function parseRoomsFromLineOrder({ lines, rawText }) {
  const sourceLines =
    Array.isArray(lines) && lines.length
      ? lines
      : String(rawText || "")
          .split(/\r?\n|\|/)
          .map((line) => line.trim())
          .filter(Boolean);

  const cleanedLines = sourceLines.map(cleanOcrLine).filter(Boolean);
  const rooms = [];
  let pendingRoom = "";
  let pendingRoomRawText = "";
  let accumulatedRoomText = "";

  for (let i = 0; i < cleanedLines.length; i += 1) {
    const line = cleanedLines[i];
    const roomLabel = normalizeRoomLabel(line);
    const pairs = extractDimensionPairs(line);

    if (roomLabel && pairs.length) {
      pairs.forEach((pair) => {
        rooms.push({
          type: roomLabel,
          length: pair.length,
          width: pair.width,
          area: Math.round(pair.length * pair.width * 100) / 100,
          rawText: line,
        });
      });
      pendingRoom = "";
      pendingRoomRawText = "";
      accumulatedRoomText = "";
      continue;
    }

    if (roomLabel) {
      pendingRoom = roomLabel;
      pendingRoomRawText = line;
      accumulatedRoomText = line;
      continue;
    }

    if (pairs.length) {
      if (pendingRoom) {
        pairs.forEach((pair) => {
          rooms.push({
            type: pendingRoom,
            length: pair.length,
            width: pair.width,
            area: Math.round(pair.length * pair.width * 100) / 100,
            rawText: line,
          });
        });
        pendingRoom = "";
        pendingRoomRawText = "";
        accumulatedRoomText = "";
      } else {
        for (let j = Math.max(0, i - 5); j < i; j += 1) {
          const backtrackLabel = normalizeRoomLabel(cleanedLines[j]);
          if (backtrackLabel) {
            pairs.forEach((pair) => {
              rooms.push({
                type: backtrackLabel,
                length: pair.length,
                width: pair.width,
                area: Math.round(pair.length * pair.width * 100) / 100,
                rawText: line,
              });
            });
            break;
          }
        }
      }
      continue;
    }

    const partial = line.toLowerCase().trim();
    const roomKeywords = [
      "master",
      "bed",
      "room",
      "bedroom",
      "living",
      "kitchen",
    ];
    if (
      roomKeywords.some(
        (kw) => partial.includes(kw) || partial === kw || kw.includes(partial),
      )
    ) {
      accumulatedRoomText = accumulatedRoomText
        ? `${accumulatedRoomText} ${line}`
        : line;
      const accumulatedLabel = normalizeRoomLabel(accumulatedRoomText);
      if (accumulatedLabel) {
        pendingRoom = accumulatedLabel;
        pendingRoomRawText = accumulatedRoomText;
      }
    }
  }

  if (pendingRoom && pendingRoomRawText) {
    const pendingPairs = extractDimensionPairs(pendingRoomRawText);
    pendingPairs.forEach((pair) => {
      rooms.push({
        type: pendingRoom,
        length: pair.length,
        width: pair.width,
        area: Math.round(pair.length * pair.width * 100) / 100,
        rawText: pendingRoomRawText,
      });
    });
  }

  return rooms.filter((room) => ROOM_TYPES.includes(room.type));
}

export function parseRoomsFromOcr({ lines, rawText, items } = {}) {
  const positionedRooms = parseRoomsFromPositionedItems(items);
  if (positionedRooms.length) return positionedRooms;
  return parseRoomsFromLineOrder({ lines, rawText });
}
