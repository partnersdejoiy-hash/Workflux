import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";
import { Shield, ChevronLeft, ChevronRight, Filter } from "lucide-react";

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  const logs = useQuery(api.audit.list, {
    action: actionFilter || undefined,
    page,
    pageSize: 30,
  });

  const totalPages = logs ? Math.ceil(logs.total / logs.pageSize) : 0;

  const actionColors: Record<string, string> = {
    shift_started: "text-terminal-green",
    shift_ended: "text-terminal-blue",
    break_started: "text-terminal-amber",
    break_ended: "text-terminal-amber",
    login: "text-terminal-green",
    employee_created: "text-terminal-green",
    employee_updated: "text-terminal-blue",
    ticket_created: "text-terminal-amber",
    ticket_approved: "text-terminal-green",
    ticket_rejected: "text-terminal-red",
    payroll_calculated: "text-terminal-green",
    payroll_approved: "text-terminal-green",
    payroll_locked: "text-terminal-blue",
    attendance_corrected: "text-terminal-amber",
    setting_updated: "text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Audit Logs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable system audit trail — {logs?.total ?? 0} entries
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="terminal-card">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Filter:</span>
            {["", "shift_started", "shift_ended", "break_started", "break_ended", "login", "ticket_created", "ticket_approved", "payroll_calculated", "employee_created"].map((action) => (
              <button
                key={action}
                onClick={() => { setActionFilter(action); setPage(0); }}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] border transition-colors",
                  actionFilter === action
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {action ? action.replace(/_/g, " ") : "All"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="terminal-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Timestamp</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Entity</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Entity ID</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs?.data?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">No audit logs found</td>
                  </tr>
                )}
                {logs?.data?.map((log) => (
                  <tr key={log._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 timer-display text-muted-foreground">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-2">
                      <p className="font-medium">{log.userName ?? "System"}</p>
                      <p className="text-[10px] text-muted-foreground">{log.userEmail}</p>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{log.userRole}</td>
                    <td className="px-4 py-2">
                      <span className={cn("font-medium", actionColors[log.action] ?? "text-foreground")}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{log.entity}</td>
                    <td className="px-4 py-2 text-muted-foreground font-mono text-[10px] truncate max-w-[100px]">
                      {log.entityId ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[150px] truncate">
                      {log.newValue ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="h-7 px-2">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="h-7 px-2">
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
