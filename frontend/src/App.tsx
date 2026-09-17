import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "./components/layout/AppShell";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { CreateProject } from "./pages/CreateProject";
import { ProjectOverview, ProjectMap, ProjectAnalytics, ProjectReports } from "./pages/ProjectPages";
import { Sites } from "./pages/Sites";
import { Projects } from "./pages/Projects";
import { ProjectSites } from "./pages/ProjectSites";
import { SiteDetail } from "./pages/SiteDetail";
import { Assistant } from "./pages/Assistant";
import { Monitoring } from "./pages/Monitoring";
import { Alerts } from "./pages/Alerts";
import { Reports, ReportDetail } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { useAuth } from "./hooks/useAuth";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="route-loading">Restoring your Darukaa session…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/dashboard" element={<Dashboard />} />
        <Route path="/app/projects" element={<Projects />} />
        <Route path="/app/projects/new" element={<CreateProject />} />
        <Route path="/app/projects/:projectId/overview" element={<ProjectOverview />} />
        <Route path="/app/projects/:projectId/map" element={<ProjectMap />} />
        <Route path="/app/projects/:projectId/sites" element={<ProjectSites />} />
        <Route path="/app/projects/:projectId/analytics" element={<ProjectAnalytics />} />
        <Route path="/app/projects/:projectId/reports" element={<ProjectReports />} />
        <Route path="/app/sites" element={<Sites />} />
        <Route path="/app/sites/:siteId" element={<SiteDetail />} />
        <Route path="/app/analytics" element={<ProjectAnalytics />} />
        <Route path="/app/assistant" element={<Assistant />} />
        <Route path="/app/monitoring" element={<Monitoring />} />
        <Route path="/app/alerts" element={<Alerts />} />
        <Route path="/app/reports" element={<Reports />} />
        <Route path="/app/reports/:reportId" element={<ReportDetail />} />
        <Route path="/app/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
