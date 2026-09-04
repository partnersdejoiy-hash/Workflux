import React, { useState, useEffect, type ReactNode } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Users,
  Building2,
  UserCog,
  Settings,
  FileText,
  ClipboardList,
  DollarSign,
  BarChart3,
  Shield,
  Bell,
  LogOut,
  ChevronLeft,
  Menu,
  Timer,
  UserCircle,
  Activity,
  AlertTriangle,
  Search,
  ChevronDown,
  Zap,
} from "lucide-react";

interface AppShellProps {
  children: ReactNode;
}

const EMPLOYEE_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { label: "My Shift", icon: Clock, path: "/app/my-shift" },
  { label: "Attendance", icon: Calendar, path: "/app/attendance" },
  { label: "Activities", icon: Activity, path: "/app/activities" },
  { label: "Corrections", icon: ClipboardList, path: "/app/corrections" },
  { label: "Payroll", icon: DollarSign, path: "/app/payroll" },
  { label: "Profile", icon: UserCircle, path: "/app/profile" },
];

const ADMIN_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { label: "Live Attendance", icon: Zap, path: "/app/live" },
  { label: "Timesheets", icon: FileText, path: "/app/timesheets" },
  { label: "Employees", icon: Users, path: "/app/employees" },
  { label: "Departments", icon: Building2, path: "/app/departments" },
  { label: "Teams", icon: UserCog, path: "/app/teams" },
  { label: "Shifts", icon: Timer, path: "/app/shifts" },
  { label: "Corrections", icon: AlertTriangle, path: "/app/corrections" },
  { label: "Payroll", icon: DollarSign, path: "/app/payroll" },
  { label: "Reports", icon: BarChart3, path: "/app/reports" },
  { label: "Audit Logs", icon: Shield, path: "/app/audit" },
  { label: "Settings", icon: Settings, path: "/app/settings" },
];

const HR_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { label: "Live Attendance", icon: Zap, path: "/app/live" },
  { label: "Timesheets", icon: FileText, path: "/app/timesheets" },
  { label: "Employees", icon: Users, path: "/app/employees" },
  { label: "Departments", icon: Building2, path: "/app/departments" },
  { label: "Teams", icon: UserCog, path: "/app/teams" },
  { label: "Shifts", icon: Timer, path: "/app/shifts" },
  { label: "Corrections", icon: AlertTriangle, path: "/app/corrections" },
  { label: "Payroll", icon: DollarSign, path: "/app/payroll" },
  { label: "Reports", icon: BarChart3, path: "/app/reports" },
  { label: "Settings", icon: Settings, path: "/app/settings" },
];

const PAYROLL_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { label: "Payroll", icon: DollarSign, path: "/app/payroll" },
  { label: "Timesheets", icon: FileText, path: "/app/timesheets" },
  { label: "Reports", icon: BarChart3, path: "/app/reports" },
  { label: "Audit Logs", icon: Shield, path: "/app/audit" },
];

function getNavItems(role?: string) {
  switch (role) {
    case "super_admin":
      return ADMIN_NAV;
    case "hr_admin":
      return HR_NAV;
    case "payroll_admin":
      return PAYROLL_NAV;
    case "manager":
      return HR_NAV;
    default:
      return EMPLOYEE_NAV;
  }
}

export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useQuery(api.audit.getUnreadCount);
  const navItems = getNavItems(user?.role);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isAdmin = user?.role && user?.role !== "employee";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-sidebar transition-all duration-200 flex-shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-12 border-b border-border px-3 gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-terminal-green/10 rounded text-terminal-green font-bold text-xs flex-shrink-0">
            FT
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground truncate">
              Freebuff Time
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-1">
          {navItems.map((item) => {
            const isActive =
              item.path === "/app"
                ? location.pathname === "/app"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors mb-0.5",
                  isActive
                    ? "bg-terminal-green/10 text-terminal-green font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full h-8 rounded hover:bg-muted text-muted-foreground transition-colors"
          >
            <ChevronLeft
              className={cn(
                "w-4 h-4 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 bg-sidebar border-r border-border transform transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center h-12 border-b border-border px-3 gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-terminal-green/10 rounded text-terminal-green font-bold text-xs">
            FT
          </div>
          <span className="text-sm font-semibold text-foreground">Freebuff Time</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-1">
          {navItems.map((item) => {
            const isActive =
              item.path === "/app"
                ? location.pathname === "/app"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors mb-0.5",
                  isActive
                    ? "bg-terminal-green/10 text-terminal-green font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <header className="h-12 border-b border-border bg-sidebar flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1 rounded hover:bg-muted text-muted-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="h-7 w-48 lg:w-64 rounded border border-border bg-background pl-8 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Link
              to="/app/notifications"
              className="relative p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount !== undefined && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-terminal-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* User Menu */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-6 h-6 rounded bg-terminal-green/10 flex items-center justify-center">
                <span className="text-xs font-medium text-terminal-green">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-medium text-foreground leading-none">
                  {user?.name || "User"}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  {user?.role === "super_admin" ? "Super Admin" :
                   user?.role === "hr_admin" ? "HR Admin" :
                   user?.role === "manager" ? "Manager" :
                   user?.role === "payroll_admin" ? "Payroll Admin" :
                   "Employee"}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
