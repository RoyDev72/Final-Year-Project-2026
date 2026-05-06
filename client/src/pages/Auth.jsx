import { useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000";

export default function Auth({ redirectTo = "/", adminMode = false }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const saveSessionAndRedirect = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    window.location.href = redirectTo || "/";
  };

  const handleLogin = async () => {
    const res = await axios.post(`${API_BASE}/api/auth/login`, {
      email,
      password,
    });
    saveSessionAndRedirect(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email || !password) {
      setMessage("Please fill all required fields.");
      return;
    }

    try {
      setLoading(true);
      await handleLogin();
    } catch (error) {
      setMessage(error?.response?.data?.msg || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: adminMode
          ? "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #111827 100%)"
          : "#f3f4f6",
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-lg p-6"
        style={{
          background: adminMode ? "#0b1220" : "white",
          border: adminMode ? "1px solid rgba(96,165,250,0.25)" : "none",
          color: adminMode ? "white" : undefined,
        }}
      >
        {adminMode && (
          <div
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: "999px",
              background: "rgba(59,130,246,0.18)",
              color: "#93c5fd",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              marginBottom: "12px",
            }}
          >
            ADMIN ACCESS
          </div>
        )}

        {!adminMode && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">
              Need admin access?
            </span>
            <a
              href="/admin/login?redirect=/admin/pricing"
              className="font-semibold text-blue-700"
            >
              Admin Panel
            </a>
          </div>
        )}

        <h1
          className="text-2xl font-bold"
          style={{ color: adminMode ? "white" : "#111827" }}
        >
          {adminMode ? "Admin Login" : "Login"}
        </h1>
        <p
          className="mt-1"
          style={{ color: adminMode ? "#cbd5e1" : "#4b5563" }}
        >
          {adminMode
            ? "Sign in to manage pricing, branding and admin settings"
            : "Credentials not required - provided by admin"}
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-lg p-2"
            style={{
              border: adminMode ? "1px solid #334155" : "1px solid #d1d5db",
              background: adminMode ? "#111827" : "white",
              color: adminMode ? "white" : undefined,
            }}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-lg p-2"
            style={{
              border: adminMode ? "1px solid #334155" : "1px solid #d1d5db",
              background: adminMode ? "#111827" : "white",
              color: adminMode ? "white" : undefined,
            }}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-2 font-semibold text-white"
            style={{
              background: adminMode ? "#2563eb" : "#059669",
            }}
          >
            {loading ? "Please wait..." : "Login"}
          </button>

          {message && (
            <p className="text-sm font-semibold text-red-500">{message}</p>
          )}
        </form>
      </div>
    </div>
  );
}
