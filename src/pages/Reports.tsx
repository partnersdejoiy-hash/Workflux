import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration } from "@/lib/utils";
import {
  BarChart3,
  FileText,
  Download,
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const reportTypes = [
  { id: "daily", name: "Daily Attendance", icon: Calendar, description: "View attendance for a specific day" },
  { id: "weekly", name: "Weekly Summary", icon: FileText, description: "Weekly attendance and hours summary" },
  { id: "monthly", name: "Monthly Report", icon: BarChart3, description: "Monthly attendance and payroll overview" },
  { id: "overtime", name: "Overtime Report", icon: Clock, description: "Employee overtime analysis" },
  { id: "absence", name: "Absence Report", icon: AlertTriangle, description: "Employee absence tracking" },
  { id: "activity", name: "Activity Analysis", icon: Activity, description: "Activity time distribution" },
];

export default function Reports() {
  const stats = useQuery(api.attendance.getStats);
  const liveData = useQuery(api.attendance.getLiveAttendance);
  const [selectedReport, setSelectedReport] = useState("daily");

  // Mock chart data based on live attendance
  const deptHours = liveData?.reduce((acc, emp) => {
    const dept = emp.departmentName ?? "Unknown";
    acc[dept] = (acc[dept] ?? 0) + (emp.netMinutes ?? 0) / 60;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(deptHours ?? {}).map(([name, hours]) => ({
    name,
    hours: Math.round(hours * 10) / 10,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Generate and export workforce reports</p>
        </div>
      </div>

      {/* Report Types */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={cn(
              "p-3 rounded border text-left transition-colors",
              selectedReport === report.id
                ? "border-terminal-green bg-terminal-green/5"
                : "border-border bg-card hover:bg-muted/50"
            )}
          >
            <report.icon className={cn(
              "w-5 h-5 mb-2",
              selectedReport === report.id ? "text-terminal-green" : "text-muted-foreground"
            )} />
            <p className="text-xs font-medium">{report.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{report.description}</p>
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Summary Stats */}
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Department Hours Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8d8d4" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b6b6b" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b6b6b" }} />
                    <Tooltip
                      contentStyle={{
                        background: "#fff",
                        border: "1px solid #d8d8d4",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                    <Bar dataKey="hours" fill="#2d7a2d" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Today's Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {[
                { label: "Total Employees", value: stats?.totalEmployees ?? 0, color: "text-foreground" },
                { label: "Currently Working", value: stats?.working ?? 0, color: "text-terminal-green" },
                { label: "On Break", value: stats?.onBreak ?? 0, color: "text-terminal-amber" },
                { label: "Completed Today", value: stats?.completed ?? 0, color: "text-terminal-blue" },
                { label: "Total Hours Today", value: `${stats?.totalHours ?? 0}h`, color: "text-terminal-green" },
                { label: "Overtime Hours", value: `${stats?.overtimeHours ?? 0}h`, color: "text-terminal-amber" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={cn("text-sm font-medium timer-display", item.color)}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 gap-2" size="sm">
              <Download className="w-3.5 h-3.5" />
              Export Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
