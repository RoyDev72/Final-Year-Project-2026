import { Suspense, lazy, useEffect } from "react";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminPricing = lazy(() => import("./pages/AdminPricing"));
const AdminBranding = lazy(() => import("./pages/AdminBranding"));
const ProjectView = lazy(() => import("./pages/ProjectView"));
const FloorPlanResult = lazy(() => import("./pages/FloorPlanResult"));
const Auth = lazy(() => import("./pages/Auth"));

const LoadingView = () => (
  <div style={{ padding: "24px", color: "#334155", fontWeight: 600 }}>
    Loading...
  </div>
);

function App() {
  const path = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);
  const redirectTo = searchParams.get("redirect") || "/";
  const adminRedirectTo = redirectTo || "/admin/pricing";
  const token = localStorage.getItem("token");
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();
  const isAdmin = user?.role === "admin";
  const shouldRedirectAdminLogin =
    path.startsWith("/admin/login") && Boolean(token && isAdmin);

  useEffect(() => {
    if (shouldRedirectAdminLogin) {
      window.location.assign(adminRedirectTo);
    }
  }, [adminRedirectTo, shouldRedirectAdminLogin]);

  if (path.startsWith("/admin/login")) {
    if (shouldRedirectAdminLogin) {
      return null;
    }

    return (
      <Suspense fallback={<LoadingView />}>
        <Auth redirectTo={adminRedirectTo} adminMode />
      </Suspense>
    );
  }

  if (path.startsWith("/login")) {
    return (
      <Suspense fallback={<LoadingView />}>
        <Auth redirectTo={redirectTo} />
      </Suspense>
    );
  }

  if (path.startsWith("/project/")) {
    return (
      <Suspense fallback={<LoadingView />}>
        <ProjectView />
      </Suspense>
    );
  }

  if (path.startsWith("/floorplan/result/")) {
    return (
      <Suspense fallback={<LoadingView />}>
        <FloorPlanResult />
      </Suspense>
    );
  }

  if (path.startsWith("/admin") && (!token || !isAdmin)) {
    return (
      <Suspense fallback={<LoadingView />}>
        <Auth redirectTo={path || "/admin/pricing"} adminMode />
      </Suspense>
    );
  }

  if (path.startsWith("/admin/pricing")) {
    return (
      <Suspense fallback={<LoadingView />}>
        <AdminLayout>
          <AdminPricing />
        </AdminLayout>
      </Suspense>
    );
  }

  if (path.startsWith("/admin/branding")) {
    return (
      <Suspense fallback={<LoadingView />}>
        <AdminLayout>
          <AdminBranding />
        </AdminLayout>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingView />}>
      <Layout>
        <Dashboard />
      </Layout>
    </Suspense>
  );
}

export default App;
