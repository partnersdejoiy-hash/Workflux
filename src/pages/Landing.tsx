import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Users,
  Shield,
  BarChart3,
  Calendar,
  Zap,
  ArrowRight,
  CheckCircle2,
  Timer,
  DollarSign,
  Building2,
  ChevronRight,
} from "lucide-react";

const features = [
  {
    icon: Timer,
    title: "Precision Timekeeping",
    description:
      "Server-side clock-in/clock-out with live timers, break tracking, and overtime calculation down to the second.",
  },
  {
    icon: Users,
    title: "Workforce Visibility",
    description:
      "Real-time attendance dashboards showing who's working, on break, or absent — across every department.",
  },
  {
    icon: DollarSign,
    title: "Payroll Integration",
    description:
      "Automatic payroll calculation from attendance data with configurable pay rates, overtime multipliers, and holiday pay.",
  },
  {
    icon: Shield,
    title: "Audit & Compliance",
    description:
      "Immutable audit logs, correction ticket workflows, and timesheet locking for full regulatory compliance.",
  },
  {
    icon: Calendar,
    title: "Shift Management",
    description:
      "Create, assign, and manage shifts with grace periods, overnight detection, and working-day configuration.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description:
      "Department-level analytics, overtime reports, absence tracking, and exportable CSV reports for every metric.",
  },
];

const stats = [
  { value: "99.9%", label: "Uptime" },
  { value: "<100ms", label: "Clock-in Latency" },
  { value: "SOC 2", label: "Compliant" },
  { value: "24/7", label: "Support" },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Nav ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-terminal-green/10 font-bold text-xs text-terminal-green">
              FT
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Freebuff Time
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button
                onClick={() => navigate("/app")}
                size="sm"
                className="bg-terminal-green hover:bg-terminal-green/90 text-white"
              >
                Dashboard
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/auth")}
                >
                  Sign in
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="bg-terminal-green hover:bg-terminal-green/90 text-white"
                >
                  Get Started
                  <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(45,122,45,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(45,122,45,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-terminal-green/5 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 md:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-terminal-green/20 bg-terminal-green/5 px-3 py-1">
              <Zap className="w-3 h-3 text-terminal-green" />
              <span className="text-[11px] font-medium text-terminal-green">
                Enterprise Workforce Platform
              </span>
            </div>

            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Workforce timekeeping
              <br />
              <span className="text-terminal-green">built for scale</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Precision attendance tracking, shift management, and payroll
              calculation in one integrated platform. Designed for teams that
              demand accuracy and accountability.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate(isAuthenticated ? "/app" : "/auth")}
                className="bg-terminal-green hover:bg-terminal-green/90 text-white px-6"
              >
                {isAuthenticated ? "Open Dashboard" : "Start Free Trial"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-6"
              >
                See Features
              </Button>
            </div>
          </motion.div>

          {/* Hero terminal mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-red/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-amber/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-green/60" />
              <span className="ml-3 text-[10px] text-muted-foreground">
                Freebuff Time — Dashboard
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
              {/* Stat cards */}
              <div className="rounded border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Working Now</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
                </div>
                <p className="text-2xl font-bold text-terminal-green timer-display">47</p>
                <p className="text-[10px] text-muted-foreground mt-1">across 4 departments</p>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Hours Today</span>
                </div>
                <p className="text-2xl font-bold text-foreground timer-display">312.5h</p>
                <p className="text-[10px] text-terminal-amber mt-1">18.3h overtime</p>
              </div>
              <div className="rounded border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">On Break</span>
                </div>
                <p className="text-2xl font-bold text-terminal-amber timer-display">8</p>
                <p className="text-[10px] text-muted-foreground mt-1">avg break 28 min</p>
              </div>

              {/* Live timer mockup */}
              <div className="md:col-span-2 rounded border border-terminal-green/20 bg-terminal-green/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Live Shift Timer</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-terminal-green/10 px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
                    <span className="text-[9px] font-medium text-terminal-green">CLOCKED IN</span>
                  </span>
                </div>
                <p className="text-4xl font-bold text-terminal-green timer-display text-center mb-3">
                  06:42:17
                </p>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Started</p>
                    <p className="text-xs font-medium">09:03 AM</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Ends</p>
                    <p className="text-xs font-medium">06:00 PM</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Worked</p>
                    <p className="text-xs font-medium text-terminal-green">6h 42m</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Remaining</p>
                    <p className="text-xs font-medium">1h 17m</p>
                  </div>
                </div>
              </div>

              {/* Activity breakdown */}
              <div className="rounded border border-border bg-background p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Activity Split</p>
                <div className="space-y-2">
                  {[
                    { name: "Customer Support", pct: 45, color: "bg-terminal-green" },
                    { name: "Training", pct: 25, color: "bg-terminal-amber" },
                    { name: "Meeting", pct: 15, color: "bg-purple-500" },
                    { name: "Admin", pct: 15, color: "bg-terminal-blue" },
                  ].map((a) => (
                    <div key={a.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] text-muted-foreground">{a.name}</span>
                        <span className="text-[9px] font-medium">{a.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${a.color}`}
                          style={{ width: `${a.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Stats bar ────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-4xl grid-cols-2 md:grid-cols-4 gap-6 px-6 py-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-foreground timer-display">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-terminal-green uppercase tracking-wider mb-2">
            Platform Features
          </p>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Everything your workforce needs
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            A complete workforce management platform — from clock-in to payroll —
            built with precision, security, and scalability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group rounded-lg border border-border bg-card p-5 hover:border-terminal-green/30 hover:shadow-sm transition-all"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded bg-terminal-green/10">
                <f.icon className="w-4.5 h-4.5 text-terminal-green" />
              </div>
              <h3 className="text-sm font-semibold mb-1.5">{f.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-terminal-green uppercase tracking-wider mb-2">
              How It Works
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Three steps to accurate timekeeping
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Clock In",
                desc: "Employees start their shift with one click. Server-side timestamps ensure accuracy with grace period and lateness detection.",
                icon: Clock,
              },
              {
                step: "02",
                title: "Track & Manage",
                desc: "Track activities, breaks, and overtime in real-time. Managers monitor live attendance across all departments.",
                icon: Zap,
              },
              {
                step: "03",
                title: "Calculate & Pay",
                desc: "Automated payroll calculation from attendance data. Review, approve, and lock periods for immutable records.",
                icon: DollarSign,
              },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-bold text-terminal-green/20 timer-display">
                    {item.step}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded bg-terminal-green/10 mb-3">
                  <item.icon className="w-4.5 h-4.5 text-terminal-green" />
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{item.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Roles ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-terminal-green uppercase tracking-wider mb-2">
            Role-Based Access
          </p>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            The right access for every role
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              role: "Employee",
              features: [
                "Start/End Shift",
                "Break Management",
                "Activity Tracking",
                "Attendance History",
                "Correction Requests",
                "Payroll Summary",
              ],
              icon: Users,
            },
            {
              role: "Manager",
              features: [
                "Team Attendance",
                "Approve Corrections",
                "Shift Assignment",
                "Timesheet Review",
                "Team Reports",
                "Activity Monitoring",
              ],
              icon: Building2,
            },
            {
              role: "HR Admin",
              features: [
                "Employee Management",
                "Department/Team Setup",
                "Leave Management",
                "Attendance Override",
                "Compliance Reports",
                "System Configuration",
              ],
              icon: Shield,
            },
            {
              role: "Payroll Admin",
              features: [
                "Payroll Calculation",
                "Pay Rate Config",
                "Period Locking",
                "Payroll Export",
                "Audit Trail",
                "Financial Reports",
              ],
              icon: DollarSign,
            },
          ].map((r) => (
            <div
              key={r.role}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded bg-terminal-green/10 mb-3">
                <r.icon className="w-4.5 h-4.5 text-terminal-green" />
              </div>
              <h3 className="text-sm font-semibold mb-3">{r.role}</h3>
              <ul className="space-y-1.5">
                {r.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-terminal-green flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────── */}
      <section className="border-y border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Ready to modernize your workforce?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Stop relying on spreadsheets and manual timesheets. Deploy
            enterprise-grade timekeeping in minutes.
          </p>
          <div className="mt-8">
            <Button
              size="lg"
              onClick={() => navigate(isAuthenticated ? "/app" : "/auth")}
              className="bg-terminal-green hover:bg-terminal-green/90 text-white px-8"
            >
              {isAuthenticated ? "Go to Dashboard" : "Get Started Free"}
              <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-terminal-green/10 font-bold text-[8px] text-terminal-green">
              FT
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Freebuff Time
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            &copy; {new Date().getFullYear()} Freebuff. Enterprise Workforce Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
