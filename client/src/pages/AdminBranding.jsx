import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000";

export default function AdminBranding() {
  const [branding, setBranding] = useState({
    companyName: "",
    logoUrl: "",
    primaryColor: "#111827",
    secondaryColor: "#16a34a",
    footerText: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const token = localStorage.getItem("token");

  const fetchBranding = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/admin/branding`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = res.data || {};
      setBranding({
        companyName: data.companyName || "",
        logoUrl: data.logoUrl || "",
        primaryColor: data.primaryColor || "#111827",
        secondaryColor: data.secondaryColor || "#16a34a",
        footerText: data.footerText || "",
      });
    } catch (error) {
      setMessage(error?.response?.data?.msg || "Failed to load branding.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const handleChange = (field, value) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      setSaving(true);
      await axios.put(`${API_BASE}/api/admin/branding`, branding, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessage("Branding updated successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.msg || "Failed to update branding.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      setMessage("Please select a logo file first.");
      return;
    }

    try {
      setUploadingLogo(true);
      setMessage("");

      const formData = new FormData();
      formData.append("logo", logoFile);

      const res = await axios.post(
        `${API_BASE}/api/admin/branding/logo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const uploadedUrl = res.data?.logoUrl || "";
      if (uploadedUrl) {
        setBranding((prev) => ({ ...prev, logoUrl: uploadedUrl }));
      }

      setMessage(
        "Logo uploaded successfully. Click Save Branding to finalize all settings.",
      );
      setLogoFile(null);
    } catch (error) {
      setMessage(error?.response?.data?.msg || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setMessage("");
      setUploadingLogo(true);

      await axios.delete(`${API_BASE}/api/admin/branding/logo`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setBranding((prev) => ({ ...prev, logoUrl: "" }));
      setLogoFile(null);
      setMessage("Logo removed successfully.");
    } catch (error) {
      setMessage(error?.response?.data?.msg || "Failed to remove logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Admin Branding</h1>
        <p className="mt-3 text-red-600">
          Token not found. Login first, then set token in localStorage.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Admin Branding</h1>
        <p className="text-gray-600 mt-1">
          Control logo, colors and report footer from one place.
        </p>
      </div>

      <form
        className="bg-white rounded-xl p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-semibold mb-4">Brand Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Company Name"
            value={branding.companyName}
            onChange={(e) => handleChange("companyName", e.target.value)}
          />
          <input
            className="border rounded p-2"
            placeholder="Logo URL"
            value={branding.logoUrl}
            onChange={(e) => handleChange("logoUrl", e.target.value)}
          />
          <div>
            <label className="text-sm text-gray-600">Primary Color</label>
            <input
              className="border rounded p-2 w-full"
              type="color"
              value={branding.primaryColor}
              onChange={(e) => handleChange("primaryColor", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Secondary Color</label>
            <input
              className="border rounded p-2 w-full"
              type="color"
              value={branding.secondaryColor}
              onChange={(e) => handleChange("secondaryColor", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 border rounded p-3 bg-gray-50">
          <p className="text-sm font-semibold mb-2">Upload Logo Image</p>
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="border rounded p-2 bg-white"
            />
            <button
              type="button"
              onClick={handleLogoUpload}
              disabled={uploadingLogo}
              className="bg-emerald-600 text-white rounded px-4 py-2"
            >
              {uploadingLogo ? "Uploading..." : "Upload Logo"}
            </button>
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={uploadingLogo || !branding.logoUrl}
              className="bg-rose-600 text-white rounded px-4 py-2"
            >
              Remove Logo
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Supported: JPG, PNG, WEBP up to 5MB.
          </p>
        </div>

        <textarea
          className="border rounded p-2 w-full mt-3"
          rows={3}
          placeholder="Footer text"
          value={branding.footerText}
          onChange={(e) => handleChange("footerText", e.target.value)}
        />

        <button
          type="submit"
          disabled={saving || loading}
          className="mt-4 bg-indigo-600 text-white rounded px-4 py-2"
        >
          {saving ? "Saving..." : "Save Branding"}
        </button>

        {message && (
          <p className="mt-3 text-sm font-semibold text-indigo-700">
            {message}
          </p>
        )}
      </form>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Live Preview</h2>
        <div
          className="rounded-lg p-4 border"
          style={{ borderColor: branding.secondaryColor || "#16a34a" }}
        >
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="logo"
                className="w-12 h-12 rounded object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded"
                style={{ background: branding.secondaryColor || "#16a34a" }}
              />
            )}
            <div>
              <p
                className="text-xl font-bold"
                style={{ color: branding.primaryColor || "#111827" }}
              >
                {branding.companyName || "Your Company Name"}
              </p>
              <p className="text-sm text-gray-500">
                This will appear in shared report and PDF.
              </p>
            </div>
          </div>

          <p
            className="mt-4 text-sm"
            style={{ color: branding.primaryColor || "#111827" }}
          >
            {branding.footerText || "Powered by Your Company"}
          </p>
        </div>
      </div>
    </div>
  );
}
