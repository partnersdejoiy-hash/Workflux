import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, getStatusBg, formatDuration } from "@/lib/utils";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from "lucide-react";

export default function Timesheets() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Default to current month range
  const now = new Date();
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  );
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime()
  );

  const timesheet = useQuery(api.attendance.getTimesheet, {
    startDate,
    endDate,
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    pageSize: 25,
    sortBy,
    sortOrder,
  });

  const totalPages = timesheet ? Math.ceil(timesheet.total / timesheet.pageSize) : 0;

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-terminal-green" />
    ) : (
      <ArrowDown className="w-3 h-3 text-terminal-green" />
    );
  };

  const formatYMD = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTS = (ts: number) =>
    new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

  const handleExportCSV = () => {
    if (!timesheet?.data) return;
    const headers = ["Date", "Employee", "Employee ID", "Department", "Shift", "Start", "End", "Net Hours", "Overtime", "Status"];
    const rows = timesheet.data.map((r) => [
      formatYMD(r.date),
      r.employeeName,
      r.employeeIdCode,
      r.departmentName,
      r.shiftName ?? "",
      r.clockIn ? formatTS(r.clockIn) : "",
      r.clockOut ? formatTS(r.clockOut) : "",
      formatDuration(r.netMinutes ?? 0),
      formatDuration(r.overtimeMinutes ?? 0),
      r.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Timesheets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {timesheet?.total ?? 0} records
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          variant="outline"
          size="sm"
          className="gap-2 self-start"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="terminal-card">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by employee name or ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="h-8 text-xs border border-border rounded px-2 bg-background"
            >
              <option value="">All Statuses</option>
              <option value="shift_completed">Completed</option>
              <option value="working">Working</option>
              <option value="on_break">On Break</option>
              <option value="late">Late</option>
              <option value="overtime">Overtime</option>
              <option value="early_leave">Early Leave</option>
            </select>
            <input
              type="date"
              value={new Date(startDate).toISOString().split("T")[0]}
              onChange={(e) => { setStartDate(new Date(e.target.value).getTime()); setPage(0); }}
              className="h-8 text-xs border border-border rounded px-2 bg-background"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={new Date(endDate).toISOString().split("T")[0]}
              onChange={(e) => { setEndDate(new Date(e.target.value).getTime()); setPage(0); }}
              className="h-8 text-xs border border-border rounded px-2 bg-background"
            />
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Table */}
      <Card className="terminal-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 sticky top-0">
                  {[
                    { key: "date", label: "Date" },
                    { key: "employeeName", label: "Employee" },
                    { key: "employeeIdCode", label: "ID" },
                    { key: "departmentName", label: "Department" },
                    { key: "shiftName", label: "Shift" },
                    { key: "clockIn", label: "Start" },
                    { key: "clockOut", label: "End" },
                    { key: "netMinutes", label: "Net Hours" },
                    { key: "overtimeMinutes", label: "Overtime" },
                    { key: "breakMinutes", label: "Break" },
                    { key: "status", label: "Status" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="text-left px-3 py-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon column={col.key} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timesheet?.data?.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-muted-foreground">
                      No records found
                    </td>
                  </tr>
                )}
                {timesheet?.data?.map((row) => (
                  <tr
                    key={row._id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium">{formatYMD(row.date)}</td>
                    <td className="px-3 py-2">{row.employeeName}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono">{row.employeeIdCode}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.departmentName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.shiftName ?? "—"}</td>
                    <td className="px-3 py-2 timer-display">
                      {row.clockIn ? formatTS(row.clockIn) : "—"}
                    </td>
                    <td className="px-3 py-2 timer-display">
                      {row.clockOut ? formatTS(row.clockOut) : "—"}
                    </td>
                    <td className="px-3 py-2 font-medium">{formatDuration(row.netMinutes ?? 0)}</td>
                    <td className="px-3 py-2 text-terminal-amber">{formatDuration(row.overtimeMinutes ?? 0)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDuration(row.breakMinutes ?? 0)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn("text-[9px]", getStatusBg(row.status))}>
                        {row.status?.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-7 px-2"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
