import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router";
import "./index.css";

// Lazy load route components
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// App shell - eagerly imported to avoid chunk-load issues with nested lazy
import AppShell from "./components/AppShell.tsx";
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard.tsx"));
const DashboardHome = lazy(() => import("./pages/DashboardHome.tsx"));
const LiveAttendance = lazy(() => import("./pages/LiveAttendance.tsx"));
const Employees = lazy(() => import("./pages/Employees.tsx"));
const Departments = lazy(() => import("./pages/Departments.tsx"));
const Teams = lazy(() => import("./pages/Teams.tsx"));
const Shifts = lazy(() => import("./pages/Shifts.tsx"));
const Timesheets = lazy(() => import("./pages/Timesheets.tsx"));
const Corrections = lazy(() => import("./pages/Corrections.tsx"));
const PayrollPage = lazy(() => import("./pages/PayrollPage.tsx"));
const Reports = lazy(() => import("./pages/Reports.tsx"));
const RequestsPage = lazy(() => import("./pages/Requests.tsx"));
const WorkfluxEditor = lazy(() => import("./pages/WorkfluxEditor.tsx"));
const AuditLogs = lazy(() => import("./pages/AuditLogs.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/** Dashboard route that selects the right view based on user role */
function DashboardRouter() {
  return (
    <AppShell>
      <Routes>
        <Route index element={<DashboardHome />} />
        <Route path="my-shift" element={<EmployeeDashboard />} />
        <Route path="attendance" element={<EmployeeDashboard />} />
        <Route path="activities" element={<EmployeeDashboard />} />
        <Route path="live" element={<LiveAttendance />} />
        <Route path="employees" element={<Employees />} />
        <Route path="departments" element={<Departments />} />
        <Route path="teams" element={<Teams />} />
        <Route path="shifts" element={<Shifts />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="editor" element={<WorkfluxEditor />} />
        <Route path="corrections" element={<Corrections />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notifications" element={<AuditLogs />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/app" />}
              />
              <Route
                path="/app/*"
                element={
                  <RequireAuth>
                    <DashboardRouter />
                  </RequireAuth>
                }
              />
              <Route path="/dashboard" element={<Navigate to="/app" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
