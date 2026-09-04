import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, getStatusBg } from "@/lib/utils";
import TimesheetGrid from "@/components/TimesheetGrid";
import {
  Search,
  Calendar,
  Zap,
  AlertTriangle,
  Clock,
  RefreshCw,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Timesheets() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"all" | "exceptions" | "corrections">("all");

  const now = new Date();
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  );
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime()
  );

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const handleQuickDate = (preset: string) => {
    const now = new Date();
    let start: Date, end: Date;

    switch (preset) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "payperiod":
        // Assume bi-monthly: 1st-15th, 16th-end
        if (now.getDate() <= 15) {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 16);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        break;
      default:
        return;
    }

    setStartDate(start.getTime());
    setEndDate(end.getTime());
    setPage(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Timesheets</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Enterprise workforce time-control workspace
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "exceptions", "corrections"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] border transition-colors",
                viewMode === mode
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {mode === "all" && <><Calendar className="w-3 h-3 inline mr-1" />All Time</>}
              {mode === "exceptions" && <><AlertTriangle className="w-3 h-3 inline mr-1" />Exceptions</>}
              {mode === "corrections" && <><Clock className="w-3 h-3 inline mr-1" />Corrections</>}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card className="terminal-card">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick date buttons */}
            <div className="flex items-center gap-1">
              {[
                { key: "today", label: "Today" },
                { key: "week", label: "This Week" },
                { key: "month", label: "This Month" },
                { key: "payperiod", label: "Pay Period" },
              ].map((d) => (
                <button
                  key={d.key}
                  onClick={() => handleQuickDate(d.key)}
                  className="px-2 py-0.5 rounded text-[10px] border border-border hover:bg-muted transition-colors"
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Date inputs */}
            <input
              type="date"
              value={new Date(startDate).toISOString().split("T")[0]}
              onChange={(e) => { setStartDate(new Date(e.target.value).getTime()); setPage(0); }}
              className="h-7 text-[10px] border border-border rounded px-2 bg-background"
            />
            <span className="text-[10px] text-muted-foreground">to</span>
            <input
              type="date"
              value={new Date(endDate).toISOString().split("T")[0]}
              onChange={(e) => { setEndDate(new Date(e.target.value).getTime()); setPage(0); }}
              className="h-7 text-[10px] border border-border rounded px-2 bg-background"
            />

            <div className="h-4 w-px bg-border" />

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search employee, ID..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-7 h-7 text-[10px]"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="h-7 text-[10px] border border-border rounded px-2 bg-background"
            >
              <option value="">All Status</option>
              <option value="working">Working</option>
              <option value="on_break">On Break</option>
              <option value="shift_completed">Completed</option>
              <option value="late">Late</option>
              <option value="overtime">Overtime</option>
              <option value="early_leave">Early Leave</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Grid */}
      <TimesheetGrid
        startDate={startDate}
        endDate={endDate}
        search={search || undefined}
        status={statusFilter || undefined}
        page={page}
        pageSize={50}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onPageChange={setPage}
      />
    </motion.div>
  );
}
