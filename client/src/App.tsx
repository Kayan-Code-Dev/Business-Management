import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { useSettings } from "./lib/SettingsContext";

import Login from "./pages/Login";
import ClientPortal from "./pages/ClientPortal";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Specialists from "./pages/Specialists";
import SpecialistDetail from "./pages/SpecialistDetail";
import Financial from "./pages/Financial";
import Invoices from "./pages/Invoices";
import InvoiceView from "./pages/InvoiceView";
import Pipeline from "./pages/Pipeline";
import Reports from "./pages/Reports";
import Activity from "./pages/Activity";
import Users from "./pages/Users";
import Settings from "./pages/Settings";

function Guard({ module, children }: { module?: string; children: JSX.Element }) {
  const { user, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (module && !can(module, "view")) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  const { refresh } = useSettings();
  const location = useLocation();

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  // بوابة العميل العامة (بدون مصادقة أو تخطيط)
  if (location.pathname.startsWith("/p/")) {
    return (
      <Routes>
        <Route path="/p/:token" element={<ClientPortal />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Guard module="dashboard"><Dashboard /></Guard>} />
        <Route path="/projects" element={<Guard module="projects"><Projects /></Guard>} />
        <Route path="/projects/:id" element={<Guard module="projects"><ProjectDetail /></Guard>} />
        <Route path="/clients" element={<Guard module="clients"><Clients /></Guard>} />
        <Route path="/clients/:id" element={<Guard module="clients"><ClientDetail /></Guard>} />
        <Route path="/specialists" element={<Guard module="specialists"><Specialists /></Guard>} />
        <Route path="/specialists/:id" element={<Guard module="specialists"><SpecialistDetail /></Guard>} />
        <Route path="/financial" element={<Guard module="financial"><Financial /></Guard>} />
        <Route path="/invoices" element={<Guard module="financial"><Invoices /></Guard>} />
        <Route path="/invoices/:id" element={<Guard module="financial"><InvoiceView /></Guard>} />
        <Route path="/pipeline" element={<Guard module="pipeline"><Pipeline /></Guard>} />
        <Route path="/reports" element={<Guard module="reports"><Reports /></Guard>} />
        <Route path="/activity" element={<Guard><Activity /></Guard>} />
        <Route path="/users" element={<Guard module="users"><Users /></Guard>} />
        <Route path="/settings" element={<Guard module="settings"><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
