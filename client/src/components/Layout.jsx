import { FaCalculator, FaLock } from "react-icons/fa";

export default function Layout({ children }) {
  const token = localStorage.getItem("token");
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();
  const isAdmin = Boolean(token) && user?.role === "admin";

  return (
    <div
      className="brand-gradient"
      style={{
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          backdropFilter: "blur(8px)",
          background: "rgba(255,255,255,0.75)",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "var(--brand-ink)",
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}
          >
            <FaCalculator />
            <span>InteriorAI Studio</span>
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              color: "var(--brand-muted)",
              fontSize: "14px",
            }}
          >
            AI floor plan estimation and downloadable cost reports
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a
            href={
              isAdmin
                ? "/admin/pricing"
                : "/admin/login?redirect=/admin/pricing"
            }
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1e40af";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 8px 18px rgba(30,64,175,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#1d4ed8";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 700,
              color: "white",
              background: "#1d4ed8",
              border: "1px solid #1e40af",
              borderRadius: "999px",
              padding: "7px 12px",
              textDecoration: "none",
              transition:
                "background 160ms ease, transform 160ms ease, box-shadow 160ms ease",
            }}
          >
            <FaLock size={11} />
            {isAdmin ? "Admin Panel" : "Admin Login"}
          </a>

          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--brand-primary)",
              background: "var(--brand-primary-soft)",
              border:
                "1px solid color-mix(in srgb, var(--brand-primary) 30%, white)",
              borderRadius: "999px",
              padding: "6px 10px",
            }}
          >
            Public MVP
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "10px 0 24px",
        }}
      >
        {children}
      </div>
    </div>
  );
}
