import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

export default function ProjectView() {
  const [project, setProject] = useState(null);
  const [branding, setBranding] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const shareId = useMemo(() => {
    const parts = window.location.pathname.split("/");
    return parts[2] || "";
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [projectRes, brandingRes] = await Promise.all([
          axios.get(`${API_BASE}/api/projects/share/${shareId}`),
          axios.get(`${API_BASE}/api/admin/branding/public`),
        ]);

        setProject(projectRes.data);
        setBranding(brandingRes.data || {});
      } catch (err) {
        setError(err?.response?.data?.msg || "Unable to load shared project.");
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      loadData();
    } else {
      setError("Invalid share link.");
      setLoading(false);
    }
  }, [shareId]);

  if (loading) {
    return <div className="p-8 text-lg">Loading shared report...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600 font-semibold">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-6">
        <div className="border-b pb-4 mb-5">
          <h1
            className="text-3xl font-bold"
            style={{ color: branding.primaryColor || "#111827" }}
          >
            {branding.companyName || "Interior Cost Report"}
          </h1>
          <p className="text-gray-600 mt-1">Project: {project.projectName}</p>
          <p className="text-gray-600">Total: Rs. {project.totalCost}</p>
        </div>

        <div className="space-y-3">
          {project.rooms?.map((room, i) => (
            <div
              key={`${room.name}-${i}`}
              className="bg-gray-50 rounded-lg p-3 border"
            >
              <p className="font-semibold">{room.name}</p>
              <p>Area: {room.area}</p>
              <p>Cost: Rs. {room.cost}</p>
            </div>
          ))}
        </div>

        {project.report && (
          <div className="mt-5 p-4 rounded-lg bg-emerald-50 border border-emerald-100">
            <h2 className="font-bold mb-2">Summary</h2>
            <p>{project.report}</p>
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500">
          {branding.footerText || "Powered by Interior AI"}
        </p>
      </div>
    </div>
  );
}
