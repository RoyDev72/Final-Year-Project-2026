import { FaPalette } from "react-icons/fa";
import { FaCalculator } from "react-icons/fa";
import { MdAdminPanelSettings } from "react-icons/md";

export default function AdminLayout({ children }) {
  const currentPath = window.location.pathname;
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const linkStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "8px",
    textDecoration: "none",
    color: "white",
    background: active ? "#1f2937" : "transparent",
    marginBottom: "8px",
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div
        style={{
          width: "240px",
          background: "#111827",
          color: "white",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: "30px" }}>
          <div
            style={{
              display: "inline-block",
              background: "#2563eb",
              color: "white",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "4px 10px",
              borderRadius: "999px",
              marginBottom: "10px",
            }}
          >
            Admin Only
          </div>
          <h2 style={{ margin: 0 }}>🏢 Admin Panel</h2>
          <p style={{ margin: "6px 0 0", fontSize: "13px", opacity: 0.75 }}>
            Manage pricing, branding and materials
          </p>
        </div>

        <a href="/" style={linkStyle(currentPath === "/")}>
          <FaCalculator />
          <span>Go To Calculator</span>
        </a>

        <a
          href="/admin/pricing"
          style={linkStyle(currentPath.startsWith("/admin/pricing"))}
        >
          <MdAdminPanelSettings />
          <span>Admin Pricing</span>
        </a>

        <a
          href="/admin/branding"
          style={linkStyle(currentPath.startsWith("/admin/branding"))}
        >
          <FaPalette />
          <span>Admin Branding</span>
        </a>

        <div style={{ marginTop: "auto", paddingTop: "20px" }}>
          <p style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
            Signed in as {user?.role || "user"}
          </p>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              window.location.href = "/admin/login?redirect=/admin/pricing";
            }}
            style={{
              width: "100%",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "20px",
          background: "#f3f4f6",
        }}
      >
        {children}
      </div>
    </div>
  );
}
