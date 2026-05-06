import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../config";

export default function AdminPricing() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    roomType: "bedroom",
    basic: "",
    premium: "",
    luxury: "",
  });

  const token = localStorage.getItem("token");

  const fetchPricing = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/admin/pricing`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setRows(res.data || []);
    } catch (error) {
      setMessage(error?.response?.data?.msg || "Failed to load pricing.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      await axios.put(
        `${API_BASE}/api/admin/pricing`,
        {
          roomType: form.roomType.trim().toLowerCase(),
          basic: Number(form.basic),
          premium: Number(form.premium),
          luxury: Number(form.luxury),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setMessage("Pricing saved successfully.");
      setForm({ roomType: "bedroom", basic: "", premium: "", luxury: "" });
      fetchPricing();
    } catch (error) {
      setMessage(error?.response?.data?.msg || "Failed to save pricing.");
    }
  };

  if (!token) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Admin Pricing</h1>
        <p className="mt-3 text-red-600">
          Token not found. Login first, then set token in localStorage.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Admin Pricing</h1>
        <p className="text-gray-600 mt-1">
          Control room-wise basic, premium and luxury rates.
        </p>
      </div>

      <form
        className="bg-white rounded-xl p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-semibold mb-4">Add Or Update Pricing</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Room type"
            value={form.roomType}
            onChange={(e) => setForm({ ...form, roomType: e.target.value })}
            required
          />
          <input
            className="border rounded p-2"
            type="number"
            placeholder="Basic"
            value={form.basic}
            onChange={(e) => setForm({ ...form, basic: e.target.value })}
            required
          />
          <input
            className="border rounded p-2"
            type="number"
            placeholder="Premium"
            value={form.premium}
            onChange={(e) => setForm({ ...form, premium: e.target.value })}
            required
          />
          <input
            className="border rounded p-2"
            type="number"
            placeholder="Luxury"
            value={form.luxury}
            onChange={(e) => setForm({ ...form, luxury: e.target.value })}
            required
          />
        </div>

        <button
          type="submit"
          className="mt-4 bg-emerald-600 text-white rounded px-4 py-2"
        >
          Save Pricing
        </button>

        {message && (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        )}
      </form>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Current Pricing Table</h2>

        {loading ? (
          <p className="text-gray-600">Loading pricing...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-600">No pricing rows yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 border">Room Type</th>
                  <th className="text-left p-2 border">Basic</th>
                  <th className="text-left p-2 border">Premium</th>
                  <th className="text-left p-2 border">Luxury</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="p-2 border">{row.roomType}</td>
                    <td className="p-2 border">{row.basic}</td>
                    <td className="p-2 border">{row.premium}</td>
                    <td className="p-2 border">{row.luxury}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
