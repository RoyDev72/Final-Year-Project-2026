import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FaCloudUploadAlt } from "react-icons/fa";
import { API_BASE } from "../config";

const SQM_TO_SQFT = 10.7639;

const getSafeFileName = (value, extension) => {
  const base =
    String(value || "Interior_AI_Report")
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "Interior_AI_Report";

  return `${base}.${extension}`;
};

const formatMoney = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const ROOM_OPTIONS = [
  "living room",
  "bedroom",
  "master bedroom",
  "porch",
  "pooja",
  "utility",
  "kitchen",
  "bathroom",
  "dining",
  "balcony",
  "study",
];

const ROOM_TYPE_ALIASES = {
  masterbedroom: "master bedroom",
  "master bedroom": "master bedroom",
  "master bed": "master bedroom",
  "m bedroom": "master bedroom",
  "m bed": "master bedroom",
  "m. bedroom": "master bedroom",
  "m. bed": "master bedroom",
  "bed room": "bedroom",
  bedroom: "bedroom",
  washroom: "bathroom",
  "wash room": "bathroom",
  restroom: "bathroom",
  toilet: "bathroom",
  wc: "bathroom",
  lavatory: "bathroom",
  lounge: "living room",
  hall: "living room",
  lobby: "living room",
  drawing: "living room",
  drawingroom: "living room",
  "drawing room": "living room",
  "drawing hall": "living room",
  "living hall": "living room",
  "living area": "living room",
  porch: "porch",
  sitout: "porch",
  pooja: "pooja",
  puja: "pooja",
  prayer: "pooja",
  service: "utility",
  "service room": "utility",
  utility: "utility",
  "utility room": "utility",
};

const normalizeRoomType = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  const compact = raw
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return "bedroom";
  if (ROOM_OPTIONS.includes(raw)) return raw;
  if (ROOM_TYPE_ALIASES[raw]) return ROOM_TYPE_ALIASES[raw];
  if (ROOM_TYPE_ALIASES[compact]) return ROOM_TYPE_ALIASES[compact];

  if (compact.includes("master") && compact.includes("bed")) {
    return "master bedroom";
  }

  if (compact.includes("bed")) return "bedroom";
  if (
    compact.includes("bath") ||
    compact.includes("toilet") ||
    compact.includes("wash") ||
    compact.includes("wc") ||
    compact.includes("lavatory")
  ) {
    return "bathroom";
  }
  if (compact.includes("kitchen")) return "kitchen";
  if (compact.includes("dining")) return "dining";
  if (compact.includes("balcony")) return "balcony";
  if (compact.includes("porch") || compact.includes("sitout")) return "porch";
  if (
    compact.includes("pooja") ||
    compact.includes("puja") ||
    compact.includes("prayer")
  ) {
    return "pooja";
  }
  if (compact.includes("service") || compact.includes("utility")) {
    return "utility";
  }
  if (compact.includes("study")) return "study";
  if (
    compact.includes("living") ||
    compact.includes("lounge") ||
    compact.includes("hall") ||
    compact.includes("drawing") ||
    compact.includes("lobby")
  ) {
    return "living room";
  }

  return "bedroom";
};

const toPricingRoomType = (value) => {
  const normalized = normalizeRoomType(value);
  return normalized === "master bedroom" ? "bedroom" : normalized;
};

const toSupportedPricingRoomType = (value) => {
  const normalized = toPricingRoomType(value);
  if (normalized === "pooja") return "study";
  if (normalized === "utility") return "bathroom";
  if (normalized === "porch") return "balcony";
  return normalized;
};

const computeRoomConfidence = ({
  aiLabel,
  normalizedType,
  length,
  width,
  area,
}) => {
  const raw = String(aiLabel || "")
    .trim()
    .toLowerCase();

  if (!raw || raw === "manual") {
    return { level: "manual", text: "Manual" };
  }

  let score = 0;

  if (raw === normalizedType) {
    score += 60;
  } else if (ROOM_TYPE_ALIASES[raw] === normalizedType) {
    score += 45;
  } else if (raw.includes(normalizedType.split(" ")[0])) {
    score += 30;
  }

  if (Number(length) > 0 && Number(width) > 0) {
    score += 25;
  }

  if (Number(area) > 0) {
    score += 15;
  }

  if (score >= 80) return { level: "high", text: "High" };
  if (score >= 50) return { level: "medium", text: "Medium" };
  return { level: "low", text: "Low" };
};

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const ACCEPTED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

const getExtension = (name) => {
  const parts = String(name || "")
    .toLowerCase()
    .split(".");
  return parts.length > 1 ? parts.pop() : "";
};

export default function Calculator() {
  const pdfModuleRef = useRef(null);

  const [projectName, setProjectName] = useState("Floor Plan Project");
  const [planType, setPlanType] = useState("premium");
  const [addOns, setAddOns] = useState({
    falseCeiling: false,
    wardrobe: false,
    lighting: false,
  });

  const [rooms, setRooms] = useState([]);
  const [result, setResult] = useState(null);
  const [floorPlanResultId, setFloorPlanResultId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [branding, setBranding] = useState({});

  const [floorPlanFile, setFloorPlanFile] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [fastMode, setFastMode] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/admin/branding/public`);
        setBranding(res.data || {});
      } catch {
        setBranding({});
      }
    };

    loadBranding();
  }, []);

  const preloadPdfEngine = () => {
    if (!pdfModuleRef.current) {
      pdfModuleRef.current = import("jspdf");
    }

    return pdfModuleRef.current;
  };

  useEffect(() => {
    if (!result) return;

    const idle = window.requestIdleCallback;
    if (typeof idle === "function") {
      const id = idle(() => {
        preloadPdfEngine();
      });

      return () => window.cancelIdleCallback?.(id);
    }

    const timer = window.setTimeout(() => {
      preloadPdfEngine();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [result]);

  const totalArea = useMemo(
    () =>
      Math.round(
        rooms.reduce(
          (sum, room) =>
            sum + (Number(room.areaSqft ?? room.area) || 0),
          0,
        ) * 100,
      ) / 100,
    [rooms],
  );

  const detectedRoomTags = useMemo(() => {
    const tags = new Set();

    rooms.forEach((room) => {
      if (room.aiLabel && room.aiLabel !== "manual") {
        tags.add(room.roomType || room.aiLabel);
      }
    });

    return Array.from(tags);
  }, [rooms]);

  const maxCost = result
    ? Math.max(...result.breakdown.map((item) => Number(item.total) || 0), 1)
    : 1;

  const updateRoom = (index, field, value) => {
    setRooms((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };

      if (field === "length" || field === "width") {
        const numeric = Number(value) || 0;
        current[field] = numeric;
        current.area =
          (Number(current.length) || 0) * (Number(current.width) || 0);
        current.areaSqft =
          current.unit === "metric"
            ? Number((current.area * SQM_TO_SQFT).toFixed(2))
            : Number(current.area.toFixed(2));
      } else if (field === "area") {
        current.area = Number(value) || 0;
        current.areaSqft =
          current.unit === "metric"
            ? Number((current.area * SQM_TO_SQFT).toFixed(2))
            : current.area;
      } else {
        current[field] = value;
      }

      current.confidence = computeRoomConfidence({
        aiLabel: current.aiLabel,
        normalizedType: normalizeRoomType(current.roomType),
        length: Number(current.length) || 0,
        width: Number(current.width) || 0,
        area: Number(current.area) || 0,
      });

      updated[index] = current;
      return updated;
    });
  };

  const addRoom = () => {
    setRooms((prev) => [
      ...prev,
      {
        roomType: "bedroom",
        aiLabel: "manual",
        confidence: { level: "manual", text: "Manual" },
        length: 10,
        width: 10,
        area: 100,
        areaSqft: 100,
        unit: "sqft",
      },
    ]);
  };

  const removeRoom = (index) => {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  };

  const selectFloorPlanFile = (file) => {
    if (!file) return;

    const mimeType = (file.type || "").toLowerCase();
    const extension = getExtension(file.name);
    const isSupported =
      ACCEPTED_MIME_TYPES.has(mimeType) || ACCEPTED_EXTENSIONS.has(extension);

    if (!isSupported) {
      setAiMessage("Unsupported file type. Use PDF, JPEG, PNG, or WEBP.");
      return;
    }

    setFloorPlanFile(file);
    setAiMessage("");
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0] || null;
    selectFloorPlanFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer?.files?.[0] || null;
    selectFloorPlanFile(file);
  };

  const handleAnalyzeFloorPlan = async () => {
    if (!floorPlanFile) {
      setAiMessage("Upload a floor plan file to start analysis.");
      return;
    }

    try {
      setAiLoading(true);
      setAiMessage("");

      const formData = new FormData();
      formData.append("file", floorPlanFile);

      const res = await axios.post(
        `${API_BASE}/api/floorplan/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const extractedRooms = (res.data?.rooms || []).map((room) => {
        const aiLabel = String(room.type || "").trim() || "unknown";
        const roomType = normalizeRoomType(room.type);
        const length = Number(room.length) || 0;
        const width = Number(room.width) || 0;
        const area =
          Number(room.area) || Number((length * width).toFixed(2)) || 0;
        const areaSqft = Number((area * SQM_TO_SQFT).toFixed(2));

        return {
          aiLabel,
          roomType,
          confidence: computeRoomConfidence({
            aiLabel,
            normalizedType: roomType,
            length,
            width,
            area,
          }),
          length,
          width,
          area,
          areaSqft,
          unit: "metric",
        };
      });

      const derivedProjectName = floorPlanFile.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();

      if (derivedProjectName) {
        setProjectName(derivedProjectName);
      }

      if (res.data?.id) {
        setFloorPlanResultId(res.data.id);
      }

      if (extractedRooms.length) {
        setRooms(extractedRooms);
      }

      setResult(null);
      setSaveMessage("");
      setShareLink("");
      setAiMessage(
        extractedRooms.length
          ? "Plan analysis complete. Review detected spaces and continue."
          : "No rooms detected. Add spaces manually from the table.",
      );
    } catch (error) {
      const serverMsg =
        error?.response?.data?.detail || error?.response?.data?.msg;
      const networkMsg = error?.message;
      setAiMessage(
        serverMsg ||
          networkMsg ||
          "Plan analysis failed. You can still add rooms manually.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!rooms.length) {
      setAiMessage("Analyze a floor plan first, then calculate.");
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE}/api/calls/calculate`,
        {
          rooms: rooms.map((room) => ({
            roomType: toSupportedPricingRoomType(room.roomType),
            area: Number(room.areaSqft ?? room.area) || 0,
            areaSqft: Number(room.areaSqft ?? room.area) || 0,
          })),
          planType,
          addOns,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setResult(res.data);
      setSaveMessage("");
      setShareLink("");
    } catch {
      setSaveMessage(
        "Calculation failed. Check pricing setup for detected room types.",
      );
    }
  };

  const handleSaveProject = async () => {
    if (!result) {
      setSaveMessage("Generate an estimate before saving this project.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");

      const payload = {
        projectName,
        rooms: result.breakdown.map((item) => {
          const sourceRoom = rooms.find(
            (room) => room.roomType === item.roomType,
          );

          return {
            name: item.roomType,
            length: Number(sourceRoom?.length) || 0,
            width: Number(sourceRoom?.width) || 0,
            area: Number(item.area) || 0,
            cost: Number(item.total) || 0,
          };
        }),
        totalCost: Number(result.totalCost) || 0,
        report: `Plan: ${planType}. Total estimated interior cost is Rs. ${result.totalCost}.`,
      };

      const saveRes = await axios.post(`${API_BASE}/api/projects`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (saveRes.data?.shareId) {
        setShareLink(
          `${window.location.origin}/project/${saveRes.data.shareId}`,
        );
      }

      setSaveMessage("Project saved successfully.");
    } catch (err) {
      setSaveMessage(err?.response?.data?.msg || "Failed to save project.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!result) {
      setSaveMessage("Generate an estimate before downloading PDF.");
      return;
    }

    const { jsPDF } = await preloadPdfEngine();

    const doc = new jsPDF();
    const companyName = branding.companyName || "Interior AI";
    const footerText = branding.footerText || "Powered by Interior AI";
    const primaryColor = branding.primaryColor || "#0f172a";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    const hexToRgb = (hex) => {
      const cleaned = hex.replace("#", "");
      if (cleaned.length !== 6) return { r: 15, g: 23, b: 42 };
      return {
        r: parseInt(cleaned.substring(0, 2), 16),
        g: parseInt(cleaned.substring(2, 4), 16),
        b: parseInt(cleaned.substring(4, 6), 16),
      };
    };

    const rgb = hexToRgb(primaryColor);

    const titleCase = (value) =>
      String(value || "")
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    const money = (value) =>
      `Rs. ${Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 0,
      })}`;

    const addFooter = () => {
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(footerText, margin, pageHeight - 9);
      doc.text(
        `Generated on ${new Date().toLocaleDateString("en-IN")}`,
        pageWidth - margin,
        pageHeight - 9,
        { align: "right" },
      );
    };

    const ensureSpace = (neededHeight) => {
      if (y + neededHeight <= pageHeight - 24) return;
      addFooter();
      doc.addPage();
      y = 18;
    };

    const summaryArea = result.breakdown.reduce(
      (sum, item) => sum + (Number(item.area) || 0),
      0,
    );

    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(0, 0, pageWidth, 42, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(companyName, margin, y);
    y += 9;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Interior Cost Estimate Report", margin, y);
    y += 7;
    doc.setFontSize(8);
    doc.text(`Project: ${projectName}`, margin, y);
    doc.text(`Plan: ${titleCase(planType)}`, pageWidth - margin, y, {
      align: "right",
    });

    y = 54;
    const cardGap = 5;
    const cardWidth = (contentWidth - cardGap * 2) / 3;
    const cards = [
      { label: "Total Estimate", value: money(result.totalCost) },
      { label: "Detected Spaces", value: String(result.breakdown.length) },
      { label: "Total Area", value: `${summaryArea.toFixed(2)} sqft` },
    ];

    cards.forEach((card, index) => {
      const x = margin + index * (cardWidth + cardGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, cardWidth, 24, 2, 2, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(card.label.toUpperCase(), x + 4, y + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(index === 0 ? 11 : 10);
      doc.setTextColor(15, 23, 42);
      doc.text(card.value, x + 4, y + 18);
    });

    y += 36;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Cost Breakdown", margin, y);
    y += 8;

    const columns = [
      { label: "Space", width: 31, align: "left" },
      { label: "Area", width: 18, align: "right" },
      { label: "Rate", width: 23, align: "right" },
      { label: "Base", width: 27, align: "right" },
      { label: "Material", width: 27, align: "right" },
      { label: "Add-ons", width: 25, align: "right" },
      { label: "Total", width: 31, align: "right" },
    ];

    const drawTableHeader = () => {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, contentWidth, 9, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);

      let x = margin;
      columns.forEach((column) => {
        const textX =
          column.align === "right" ? x + column.width - 2 : x + 2;
        doc.text(column.label, textX, y + 6, { align: column.align });
        x += column.width;
      });

      y += 9;
    };

    drawTableHeader();

    result.breakdown.forEach((item, index) => {
      ensureSpace(10);
      if (y < 30) drawTableHeader();

      const row = [
        titleCase(item.roomType),
        `${Number(item.area || 0).toFixed(2)}`,
        money(item.rate),
        money(item.baseCost),
        money(item.materialCost),
        money(item.addOnCost),
        money(item.total),
      ];

      doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 10, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);

      let x = margin;
      columns.forEach((column, columnIndex) => {
        const textX =
          column.align === "right" ? x + column.width - 2 : x + 2;
        doc.text(row[columnIndex], textX, y + 6.5, {
          align: column.align,
        });
        x += column.width;
      });

      y += 10;
    });

    y += 4;
    ensureSpace(20);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.roundedRect(pageWidth - margin - 76, y, 76, 18, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("GRAND TOTAL", pageWidth - margin - 72, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(money(result.totalCost), pageWidth - margin - 4, y + 14, {
      align: "right",
    });

    y += 30;
    ensureSpace(18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "This estimate is generated from detected floor plan dimensions and selected plan/add-on configuration. Final quotation may vary after site validation and material selection.",
      margin,
      y,
      { maxWidth: contentWidth },
    );

    addFooter();

    doc.save(getSafeFileName(`${projectName}_cost_report`, "pdf"));
  };

  const copyShareLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setSaveMessage("Share link copied.");
    } catch {
      setSaveMessage("Could not copy link. Copy it manually.");
    }
  };

  return (
    <div className="space-y-7 pb-4">
      <section
        className="page-reveal mobile-tight brand-card elevated relative overflow-hidden rounded-3xl p-7"
        style={{ "--stagger": "20ms" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-sky-200/50 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              AI Powered Interior Estimator
            </p>
            <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">
              Upload a Floor Plan.
              <br />
              Get a Cost Report in Minutes.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-600 sm:text-base">
              This production-ready workspace analyzes floor plan images,
              extracts room dimensions, calculates interior budget, and
              generates downloadable PDF reports.
            </p>
          </div>

          <div className="hover-lift rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Quick Snapshot
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Detected Spaces</p>
                <p className="text-xl font-semibold text-slate-900">
                  {rooms.length}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Total Area</p>
                <p className="text-xl font-semibold text-slate-900">
                  {totalArea} sqft
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Plan</p>
                <p className="text-xl font-semibold capitalize text-slate-900">
                  {planType}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-sm font-semibold text-emerald-700">
                  {result ? "Estimate Ready" : "Awaiting Estimate"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mobile-stack grid items-start gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div
          className="page-reveal mobile-tight brand-card elevated space-y-6 rounded-3xl p-6"
          style={{ "--stagger": "90ms" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Step 1
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Project Setup
            </h2>
          </div>

          <div className="flex justify-center">
            <label
              className={`upload-zone upload-float w-full max-w-2xl cursor-pointer ${isDragActive ? "drag-active" : ""}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileInputChange}
                className="sr-only"
              />

              <div className="pointer-events-none absolute -left-8 top-6 h-20 w-20 rounded-full bg-teal-200/50 blur-2xl" />
              <div className="pointer-events-none absolute -right-8 bottom-8 h-16 w-16 rounded-full bg-amber-200/60 blur-xl" />

              <div className="relative flex flex-col items-center justify-center text-center">
                <div className="upload-icon-wrap">
                  <FaCloudUploadAlt className="text-3xl text-teal-700" />
                </div>
                <p className="mt-3 text-lg font-bold text-slate-800">
                  Upload Floor Plan
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {isDragActive
                    ? "Drop your file here"
                    : "Drag and drop or click to browse files"}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  PDF, JPEG, PNG, WEBP
                </p>

                <div className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                  Choose File
                </div>

                {floorPlanFile && (
                  <p className="mt-3 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    Selected: {floorPlanFile.name}
                  </p>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAnalyzeFloorPlan();
                  }}
                  disabled={aiLoading}
                  className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {aiLoading ? "Analyzing Floor Plan" : "Run Plan Analysis"}
                </button>

                <label
                  className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <input
                    type="checkbox"
                    checked={fastMode}
                    onChange={(e) => setFastMode(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  Fast mode (quicker results, may miss small rooms)
                </label>

                {aiMessage && (
                  <p className="mt-3 text-sm font-medium text-slate-600">
                    {aiMessage}
                  </p>
                )}

                {floorPlanResultId && (
                  <a
                    href={`/floorplan/result/${floorPlanResultId}`}
                    className="mt-3 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
                  >
                    View OCR Result Details
                  </a>
                )}
              </div>
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Step 2
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Review Detected Spaces
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Confirm detected output and make quick adjustments before
              calculation.
            </p>

            {detectedRoomTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {detectedRoomTags.map((tag) => (
                  <span
                    key={`detected-${tag}`}
                    className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700"
                  >
                    Detected: {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <div className="room-grid grid grid-cols-[1.2fr_1.1fr_0.9fr_1fr_1fr_1fr_auto] gap-2 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                <span>Space</span>
                <span>AI Label</span>
                <span>Confidence</span>
                <span>Length</span>
                <span>Width</span>
                <span>Area</span>
                <span>Action</span>
              </div>

              {rooms.length === 0 && (
                <div className="px-3 py-6 text-sm text-slate-500">
                  No spaces detected yet. Run AI analysis to populate this grid.
                </div>
              )}

              {rooms.map((room, index) => (
                <div
                  key={`room-${index}`}
                  className={`room-grid grid grid-cols-[1.2fr_1.1fr_0.9fr_1fr_1fr_1fr_auto] gap-2 border-t border-slate-100 px-3 py-2 ${
                    room.aiLabel && room.aiLabel !== "manual"
                      ? "bg-emerald-50/50"
                      : ""
                  }`}
                >
                  <select
                    value={room.roomType}
                    onChange={(e) =>
                      updateRoom(index, "roomType", e.target.value)
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
                  >
                    {ROOM_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-600">
                    {room.aiLabel || "manual"}
                  </div>

                  <div className="flex items-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        room.confidence?.level === "high"
                          ? "bg-emerald-100 text-emerald-700"
                          : room.confidence?.level === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : room.confidence?.level === "manual"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {room.confidence?.text || "Low"}
                    </span>
                  </div>

                  <input
                    type="number"
                    value={room.length}
                    onChange={(e) =>
                      updateRoom(index, "length", e.target.value)
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
                  />

                  <input
                    type="number"
                    value={room.width}
                    onChange={(e) => updateRoom(index, "width", e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
                  />

                  <input
                    type="number"
                    value={room.area}
                    onChange={(e) => updateRoom(index, "area", e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
                  />

                  <button
                    onClick={() => removeRoom(index)}
                    className="rounded-lg bg-rose-100 px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-200"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addRoom}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Add Missing Space
            </button>
          </div>
        </div>

        <div
          className="page-reveal mobile-tight h-fit self-start space-y-6 rounded-3xl border border-slate-200 bg-slate-950 p-7 text-white shadow-[0_12px_55px_-32px_rgba(2,6,23,0.8)] xl:sticky xl:top-24 xl:min-w-[320px]"
          style={{ "--stagger": "150ms" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
              Step 3
            </p>
            <h3 className="mt-1 text-3xl font-bold leading-tight">
              Estimate Controls
            </h3>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-200">Plan Type</p>
            <div className="mt-2 rounded-xl bg-slate-900/70 p-2">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "basic", label: "Basic" },
                  { value: "premium", label: "Premium" },
                  { value: "luxury", label: "Luxury" },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setPlanType(type.value)}
                    className={`flex h-10 w-full items-center justify-center rounded-lg px-2 text-xs font-semibold transition sm:text-sm ${
                      planType === type.value
                        ? "bg-amber-300 text-slate-900"
                        : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-200">Add-ons</p>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={addOns.falseCeiling}
                  onChange={(e) =>
                    setAddOns((prev) => ({
                      ...prev,
                      falseCeiling: e.target.checked,
                    }))
                  }
                />
                False Ceiling
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={addOns.wardrobe}
                  onChange={(e) =>
                    setAddOns((prev) => ({
                      ...prev,
                      wardrobe: e.target.checked,
                    }))
                  }
                />
                Wardrobe
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={addOns.lighting}
                  onChange={(e) =>
                    setAddOns((prev) => ({
                      ...prev,
                      lighting: e.target.checked,
                    }))
                  }
                />
                Lighting
              </label>
            </div>
          </div>

          <button
            onClick={handleCalculate}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-amber-300 px-4 text-sm font-bold text-slate-900 transition hover:bg-amber-200"
          >
            Generate Cost Estimate
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSaveProject}
              disabled={isSaving}
              className="flex h-11 items-center justify-center rounded-xl bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? "Saving" : "Save"}
            </button>
            <button
              onClick={handleDownloadPDF}
              onMouseEnter={preloadPdfEngine}
              onFocus={preloadPdfEngine}
              className="flex h-11 items-center justify-center rounded-xl bg-slate-700 px-3 text-sm font-semibold text-white hover:bg-slate-600"
            >
              Download PDF
            </button>
          </div>

          {saveMessage && (
            <p className="text-sm text-slate-200">{saveMessage}</p>
          )}

          {shareLink && (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                Share Link
              </p>
              <input
                value={shareLink}
                readOnly
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-200"
              />
              <button
                onClick={copyShareLink}
                className="mt-2 flex h-10 w-full items-center justify-center rounded-lg bg-violet-500 px-3 text-sm font-semibold text-white hover:bg-violet-400"
              >
                Copy Link
              </button>
            </div>
          )}
        </div>
      </section>

      {result && (
        <section
          className="page-reveal mobile-tight rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-[0_14px_45px_-35px_rgba(5,150,105,0.8)]"
          style={{ "--stagger": "220ms" }}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Estimated Total
              </p>
              <h3 className="mt-1 text-3xl font-bold text-emerald-950">
                Rs. {result.totalCost}
              </h3>
            </div>
            <p className="max-w-2xl text-sm text-emerald-800">
              Report is generated from AI-detected plan geometry and your
              selected pricing configuration.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">
                Cost Distribution
              </p>
              <div className="mt-3 space-y-3">
                {result.breakdown.map((item, i) => {
                  const value = Number(item.total) || 0;
                  const percent = Math.max((value / maxCost) * 100, 6);

                  return (
                    <div key={`chart-${i}`}>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="capitalize">{item.roomType}</span>
                        <span>Rs. {item.total}</span>
                      </div>
                      <div className="mt-1 h-2.5 rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">
                Room Breakdown
              </p>
              <div className="mt-3 space-y-2">
                {result.breakdown.map((item, i) => (
                  <div
                    key={`room-summary-${i}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <p className="font-semibold capitalize text-slate-800">
                      {item.roomType}
                    </p>
                    <p className="text-slate-600">Area: {item.area} sqft</p>
                    <p className="text-slate-700">Total: Rs. {item.total}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
