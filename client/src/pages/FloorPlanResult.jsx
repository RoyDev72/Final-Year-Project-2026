import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000";

export default function FloorPlanResult() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const resultId = useMemo(() => {
    const parts = window.location.pathname.split("/");
    return parts[3] || "";
  }, []);

  useEffect(() => {
    const loadResult = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `${API_BASE}/api/floorplan/result/${resultId}`,
        );
        setResult(res.data);
      } catch (err) {
        setError(
          err?.response?.data?.message || "Unable to load floor plan result.",
        );
      } finally {
        setLoading(false);
      }
    };

    if (resultId) {
      loadResult();
    } else {
      setError("Missing floor plan result id.");
      setLoading(false);
    }
  }, [resultId]);

  if (loading) {
    return <div className="p-8 text-lg">Loading floor plan result...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600 font-semibold">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow p-6">
        <div className="border-b pb-4 mb-5">
          <h1 className="text-3xl font-bold text-slate-900">
            Floor Plan OCR Result
          </h1>
          <p className="text-gray-600 mt-1">
            Total Area: {result.totalArea || 0} sqft
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(result.rooms || []).map((room, index) => (
            <div
              key={`${room.type}-${index}`}
              className="bg-gray-50 rounded-lg p-4 border"
            >
              <p className="font-semibold text-slate-900">{room.type}</p>
              <p className="text-sm text-slate-600">
                {room.length} x {room.width} ft
              </p>
              <p className="text-sm text-slate-700">Area: {room.area}</p>
              {room.rawText ? (
                <p className="text-xs text-slate-400 mt-2">
                  OCR: {room.rawText}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
