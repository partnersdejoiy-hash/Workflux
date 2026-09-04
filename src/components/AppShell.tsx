import React, { useState, useEffect, type ReactNode } from "react";
import { useNavigate, useLocation, Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import ActionCenter from "@/components/ActionCenter";
import RightRail from "@/components/RightRail";
import CommandPalette from "@/components/CommandPalette";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Inbox,
  PanelRight,
  ArrowUpRight,
  CheckCheck,
  Zap,
} from "lucide-react";

interface AppShellProps {
  children: ReactNode;
}

const EMPLOYEE_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { label: "My Shift", icon: Clock, path: "/app/my-shift" },
  { label: "Requests", icon: Inbox, path: "/app/requests" },
  { label: "Attendance", icon: Calendar, path: "/app/attendance" },
  { label: "Activities", icon: Activity, path: "/app/activities" },
  { label: "Corrections", icon: ClipboardList, path: "/app/corrections" },
  { label: "Payroll", icon: DollarSign, path: "/app/payroll" },
  { label: "Profile", icon: UserCircle, path: "/app/profile" },
];

const ADMIN_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { label: "Live Attendance", icon: Zap, path: "/app/live" },
  { label: "Requests", icon: Inbox, path: "/app/requests" },
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

const HR_NAV = ADMIN_NAV;

const PAYROLL_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/app" },
  { label: "Requests", icon: Inbox, path: "/app/requests" },
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
  const [railOpen, setRailOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useQuery(api.audit.getUnreadCount);
  const notifications = useQuery(api.audit.getMyNotifications);
  const markAsRead = useMutation(api.audit.markAsRead);
  const markAllAsRead = useMutation(api.audit.markAllAsRead);
  const navItems = getNavItems(user?.role);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const openNotification = async (n: any) => {
    try {
      if (!n.isRead) await markAsRead({ notificationId: n._id });
    } catch {
      // ignore read-mark failures; navigation still proceeds
    }
    if (n.entityType === "leaveRecord") navigate("/app/requests?tab=leave");
    else if (n.entityType === "correctionTicket") navigate("/app/requests?tab=corrections");
    else if (n.entityType === "timeAdjustment") navigate("/app/requests?tab=adjustments");
    else navigate("/app/requests");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar (Desktop) ── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-sidebar transition-all duration-200 flex-shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex items-center h-12 border-b border-border px-3 gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-terminal-green/10 rounded text-terminal-green font-bold text-xs flex-shrink-0">
            FT
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground truncate">
              Workflux
            </span>
          )}
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
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full h-8 rounded hover:bg-muted text-muted-foreground transition-colors"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 bg-sidebar border-r border-border transform transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center h-12 border-b border-border px-3 gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-terminal-green/10 rounded text-terminal-green font-bold text-xs">FT</div>
          <span className="text-sm font-semibold text-foreground">Workflux</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-1">
          {navItems.map((item) => {
            const isActive =
              item.path === "/app" ? location.pathname === "/app" : location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path}
                className={cn("flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors mb-0.5",
                  isActive ? "bg-terminal-green/10 text-terminal-green font-medium" : "text-muted-foreground hover:bg-muted")}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Right column ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <header className="h-12 border-b border-border bg-sidebar flex items-center justify-between px-4 flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1 rounded hover:bg-muted text-muted-foreground">
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 h-7 w-44 lg:w-56 rounded border border-border bg-background px-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
              title="Search / commands (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Search or command…</span>
              <kbd className="ml-auto text-[9px] font-medium text-muted-foreground/70 border border-border rounded px-1 py-px">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            {/* Workflux Editor */}
            <button
              onClick={() => navigate("/app/editor")}
              className={cn(
                "flex items-center gap-1 px-2.5 h-7 rounded text-[11px] font-semibold border transition-colors flex-shrink-0",
                location.pathname.startsWith("/app/editor")
                  ? "bg-terminal-green/15 text-terminal-green border-terminal-green/30"
                  : "text-terminal-green border-terminal-green/30 hover:bg-terminal-green/10"
              )}
            >
              WORKFLUX EDITOR <ArrowUpRight className="w-3 h-3" />
            </button>

            {/* Rail toggle */}
            <button
              onClick={() => setRailOpen((o) => !o)}
              className={cn("p-1.5 rounded hover:bg-muted text-muted-foreground hidden 2xl:block transition-colors",
                railOpen && "bg-muted text-foreground")}
              title={railOpen ? "Hide right panel" : "Show right panel"}
              aria-label="Toggle right panel"
            >
              <PanelRight className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" aria-label="Notifications">
                  <Bell className="w-4 h-4" />
                  {unreadCount !== undefined && unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-terminal-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-semibold text-foreground">Notifications</span>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={async () => {
                      try {
                        await markAllAsRead();
                      } catch {
                        // best effort
                      }
                    }}
                  >
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-auto">
                  {notifications === undefined ? (
                    <p className="p-4 text-xs text-muted-foreground">Loading…</p>
                  ) : notifications.length === 0 ? (
                    <p className="p-6 text-xs text-muted-foreground text-center">No notifications yet.</p>
                  ) : (
                    notifications.map((n: any) => (
                      <button
                        key={n._id}
                        onClick={() => openNotification(n)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/60 transition-colors",
                          !n.isRead && "bg-terminal-green/[0.04]"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {!n.isRead && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-terminal-green flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground leading-tight">{n.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {new Date(n.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* User Menu */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-6 h-6 rounded bg-terminal-green/10 flex items-center justify-center">
                <span className="text-xs font-medium text-terminal-green">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-medium text-foreground leading-none">{user?.name || "User"}</span>
                <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  {user?.role === "super_admin" ? "Super Admin"
                    : user?.role === "hr_admin" ? "HR Admin"
                    : user?.role === "manager" ? "Manager"
                    : user?.role === "payroll_admin" ? "Payroll Admin"
                    : "Employee"}
                </span>
              </div>
              <button onClick={handleSignOut} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" title="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile action strip */}
        <div className="xl:hidden border-b border-border bg-card px-3 py-2 overflow-x-auto">
          <ActionCenter horizontal />
        </div>      {/* Global command palette (Ctrl+K) */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* ── Three-zone workspace ── */}
      <div className="flex flex-1 min-h-0">
        <ActionCenter />
        <main className="flex-1 overflow-auto p-4 lg:p-5 min-w-0">{children}</main>
        {railOpen && <RightRail />}
      </div>
      </div>
    </div>
  );
}
