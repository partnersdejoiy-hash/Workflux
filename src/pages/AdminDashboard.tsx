import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, getStatusBg, formatDuration } from "@/lib/utils";
import {
  Users,
  Clock,
  Coffee,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";

const CHART_COLORS = ["#2d7a2d", "#c49a2c", "#2d6b9e", "#c44242", "#8b5e3c", "#6b5e9e"];

export default function AdminDashboard() {
  const stats = useQuery(api.attendance.getStats);
  const liveAttendance = useQuery(api.attendance.getLiveAttendance);
  const pendingCorrections = useQuery(api.corrections.list, { status: "pending", pageSize: 5 });
  const currentPeriod = useQuery(api.payroll.getCurrentPeriod);
  const exceptionCounts = useQuery(api.exceptions.getCounts);

  if (!stats) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statusData = [
    { name: "Working", value: stats.working, color: "#2d7a2d" },
    { name: "On Break", value: stats.onBreak, color: "#c49a2c" },
    { name: "Not Started", value: stats.notStarted, color: "#6b6b6b" },
    { name: "Completed", value: stats.completed, color: "#2d6b9e" },
    { name: "Absent", value: stats.absent, color: "#c44242" },
  ];

  const statCards = [
    { label: "Total Employees", value: stats.totalEmployees, icon: Users, color: "text-terminal-green" },
    { label: "Currently Working", value: stats.working, icon: PlayCircle, color: "text-terminal-green" },
    { label: "On Break", value: stats.onBreak, icon: Coffee, color: "text-terminal-amber" },
    { label: "Not Started", value: stats.notStarted, icon: Clock, color: "text-muted-foreground" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-terminal-blue" },
    { label: "Absent", value: stats.absent, icon: AlertTriangle, color: "text-terminal-red" },
    { label: "Total Hours Today", value: `${stats.totalHours}h`, icon: Timer, color: "text-terminal-green" },
    { label: "Overtime Today", value: `${stats.overtimeHours}h`, icon: TrendingUp, color: "text-terminal-amber" },
  ];

  const exceptionCards = exceptionCounts ? [
    { label: "Open Exceptions", value: exceptionCounts.open, color: "text-terminal-red", severity: "critical" },
    { label: "Critical", value: exceptionCounts.critical, color: "text-terminal-red" },
    { label: "Warnings", value: exceptionCounts.warning, color: "text-terminal-amber" },
    { label: "Info", value: exceptionCounts.info, color: "text-terminal-blue" },
  ] : [];

  const workingEmployees = liveAttendance?.filter(
    (e) => e.status === "working" || e.status === "late" || e.status === "on_break"
  ) || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Live
          </span>
          <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <Card key={i} className="terminal-card">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </span>
                <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
              </div>
              <div className={cn("text-2xl font-bold mt-1 timer-display", stat.color)}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exception Summary */}
      {exceptionCounts && exceptionCounts.open > 0 && (
        <Card className="terminal-card border-terminal-red/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-terminal-red" />
                Exceptions ({exceptionCounts.open})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-terminal-red/5 rounded border border-terminal-red/10">
                <p className="text-lg font-bold text-terminal-red timer-display">{exceptionCounts.critical}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Critical</p>
              </div>
              <div className="text-center p-2 bg-terminal-amber/5 rounded border border-terminal-amber/10">
                <p className="text-lg font-bold text-terminal-amber timer-display">{exceptionCounts.warning}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Warnings</p>
              </div>
              <div className="text-center p-2 bg-terminal-blue/5 rounded border border-terminal-blue/10">
                <p className="text-lg font-bold text-terminal-blue timer-display">{exceptionCounts.info}</p>
                <p className="text-[9px] text-muted-foreground uppercase">Info</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Workforce Distribution */}
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Workforce Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData
                      .filter((d) => d.value > 0)
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #d8d8d4",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {d.name} ({d.value})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Corrections */}
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Pending Corrections</CardTitle>
              <Badge variant="outline" className="text-[10px] bg-terminal-amber/10 text-terminal-amber border-terminal-amber/20">
                {stats.pendingCorrections}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {pendingCorrections?.data?.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No pending corrections
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingCorrections?.data?.map((ticket) => (
                  <div key={ticket._id} className="px-4 py-2.5 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{ticket.employeeName}</span>
                      <Badge variant="outline" className="text-[9px] bg-terminal-amber/10 text-terminal-amber border-terminal-amber/20">
                        PENDING
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {ticket.correctionType.replace(/_/g, " ")} — {ticket.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Payroll Period */}
      {currentPeriod && (
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Payroll Period</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Period</p>
                <p className="text-sm font-medium mt-0.5">{currentPeriod.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                <Badge variant="outline" className={cn("text-[10px] mt-0.5", getStatusBg(currentPeriod.status))}>
                  {currentPeriod.status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Employees</p>
                <p className="text-sm font-medium mt-0.5">{currentPeriod.totalEmployees ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gross Pay</p>
                <p className="text-sm font-medium mt-0.5">
                  {currentPeriod.totalGrossPay
                    ? `$${currentPeriod.totalGrossPay.toLocaleString()}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Hours</p>
                <p className="text-sm font-medium mt-0.5">
                  {currentPeriod.totalRegularHours ?? "—"}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Workforce */}
      <Card className="terminal-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Live Workforce</CardTitle>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
              <span className="text-[10px] text-muted-foreground">
                {workingEmployees.length} active
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Dept</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Shift</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Activity</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Started</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {workingEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No active employees right now
                    </td>
                  </tr>
                ) : (
                  workingEmployees.map((emp) => (
                    <tr key={emp._id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-terminal-green/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-medium text-terminal-green">
                              {emp.employeeName?.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{emp.employeeName}</p>
                            <p className="text-[10px] text-muted-foreground">{emp.employeeIdCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{emp.departmentName}</td>
                      <td className="px-4 py-2 text-muted-foreground">{emp.shiftName}</td>
                      <td className="px-4 py-2 text-muted-foreground">{emp.currentActivityName ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground timer-display">
                        {emp.clockIn
                          ? new Date(emp.clockIn).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={cn("text-[9px]", getStatusBg(emp.status))}>
                          {emp.status?.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
