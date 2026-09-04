import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration, getStatusBg } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  Maximize2,
  Minimize2,
  ChevronRight as ChevronRightIcon,
  AlertTriangle,
  Clock,
  Edit3,
  Eye,
  User,
  Calendar,
} from "lucide-react";

// ─── Column definitions ──────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  sortable?: boolean;
  sticky?: "left";
  editable?: boolean;
  align?: "left" | "center" | "right";
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "expand", label: "", width: 32, sticky: "left" },
  { key: "date", label: "Date", width: 100, sortable: true, sticky: "left" },
  { key: "employeeName", label: "Employee", width: 160, sortable: true, sticky: "left" },
  { key: "employeeIdCode", label: "ID", width: 90, sortable: true },
  { key: "departmentName", label: "Dept", width: 110, sortable: true },
  { key: "shiftName", label: "Shift", width: 100, sortable: true },
  { key: "clockIn", label: "Clock In", width: 100, sortable: true, editable: true, align: "center" },
  { key: "clockOut", label: "Clock Out", width: 100, sortable: true, editable: true, align: "center" },
  { key: "breakMinutes", label: "Break", width: 75, sortable: true, align: "center" },
  { key: "netMinutes", label: "Regular", width: 80, sortable: true, align: "center" },
  { key: "overtimeMinutes", label: "OT", width: 65, sortable: true, align: "center" },
  { key: "grossMinutes", label: "Total", width: 80, sortable: true, align: "center" },
  { key: "status", label: "Status", width: 110, sortable: true },
];

// ─── Props ───────────────────────────────────────────────────────

interface TimesheetGridProps {
  startDate: number;
  endDate: number;
  departmentId?: string;
  employeeId?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (column: string) => void;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: any) => void;
}

export default function TimesheetGrid({
  startDate,
  endDate,
  departmentId,
  employeeId,
  search,
  status,
  page = 0,
  pageSize = 50,
  sortBy = "date",
  sortOrder = "desc",
  onSort,
  onPageChange,
  onRowClick,
}: TimesheetGridProps) {
  const { user } = useAuth();
  const isAdmin = user?.role && user?.role !== "employee";

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: any } | null>(null);
  const [showColConfig, setShowColConfig] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [density, setDensity] = useState<"compact" | "comfortable" | "spacious">("compact");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(DEFAULT_COLUMNS.map((c) => c.key))
  );
  const editRef = useRef<HTMLInputElement>(null);

  const timesheet = useQuery(api.attendance.getTimesheet, {
    startDate,
    endDate,
    departmentId: departmentId as any,
    employeeId: employeeId as any,
    search: search || undefined,
    status: status || undefined,
    page,
    pageSize,
    sortBy,
    sortOrder,
  });

  const quickApply = useMutation(api.adjustments.quickApply);

  const totalPages = timesheet ? Math.ceil(timesheet.total / timesheet.pageSize) : 0;
  const columns = useMemo(() => DEFAULT_COLUMNS.filter((c) => visibleCols.has(c.key)), [visibleCols]);
  const rh = density === "compact" ? 34 : density === "comfortable" ? 42 : 54;

  // ─── Expand / Select ─────────────────────────────────────────

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedRows((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  // ─── Editing ─────────────────────────────────────────────────

  const startEdit = useCallback((rowId: string, field: string, val: string) => {
    if (!isAdmin) return;
    setEditingCell({ rowId, field });
    setEditValue(val);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [isAdmin]);

  const saveEdit = useCallback(async (row: any) => {
    if (!editingCell) return;
    try {
      let value = editValue;
      if (editingCell.field === "clockIn" || editingCell.field === "clockOut") {
        const dateStr = row.date.toString().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
        value = `${dateStr}T${editValue}:00`;
      }
      await quickApply({
        attendanceSessionId: row._id,
        field: editingCell.field,
        value,
        reason: `Timesheet edit: ${editingCell.field} updated`,
      });
      toast.success("Adjustment saved");
      setEditingCell(null);
      setEditValue("");
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    }
  }, [editingCell, editValue, quickApply]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  // ─── Context menu ────────────────────────────────────────────

  const handleCtx = useCallback((e: React.MouseEvent, row: any) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, row });
  }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ─── Keyboard ────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingCell) {
        if (e.key === "Escape") cancelEdit();
        if (e.key === "Enter") {
          const row = timesheet?.data?.find((r: any) => r._id === editingCell.rowId);
          if (row) saveEdit(row);
        }
        return;
      }
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editingCell, cancelEdit, saveEdit, isFullscreen, timesheet]);

  // ─── Export ──────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    if (!timesheet?.data) return;
    const hdrs = columns.filter((c) => c.key !== "expand").map((c) => c.label);
    const rows = timesheet.data.map((r: any) =>
      columns.filter((c) => c.key !== "expand").map((col) => {
        const v = r[col.key];
        if (col.key === "clockIn" || col.key === "clockOut")
          return v ? new Date(v).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
        if (["breakMinutes", "netMinutes", "overtimeMinutes", "grossMinutes"].includes(col.key))
          return formatDuration(v ?? 0);
        if (col.key === "status") return (v ?? "").replace(/_/g, " ");
        return v ?? "";
      })
    );
    const csv = [hdrs, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  }, [timesheet, columns]);

  // ─── Cell renderer ───────────────────────────────────────────

  const renderCell = useCallback((col: ColumnDef, row: any): React.ReactNode => {
    const val = row[col.key];

    if (col.key === "expand") {
      return (
        <button onClick={() => toggleExpand(row._id)} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronRightIcon className={cn("w-3 h-3 transition-transform", expandedRows.has(row._id) && "rotate-90")} />
        </button>
      );
    }

    if (col.key === "date") {
      const d = new Date(row.date.toString().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"));
      return <span className="font-medium">{d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>;
    }

    if (col.key === "employeeName") {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-terminal-green/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[7px] font-bold text-terminal-green">{row.employeeName?.charAt(0)}</span>
          </div>
          <span className="font-medium truncate">{row.employeeName}</span>
        </div>
      );
    }

    if (col.key === "clockIn" || col.key === "clockOut") {
      const timeStr = val ? new Date(val).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";
      const isEditing = editingCell?.rowId === row._id && editingCell?.field === col.key;

      if (isEditing) {
        return (
          <input
            ref={editRef}
            type="time"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => saveEdit(row)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(row);
              if (e.key === "Escape") cancelEdit();
            }}
            className="w-full h-5 text-[10px] border border-terminal-green rounded px-1 bg-background text-center font-mono"
          />
        );
      }

      return (
        <span
          className={cn(
            "timer-display",
            col.editable && isAdmin && "cursor-pointer hover:bg-muted rounded px-0.5",
            row.isLate && col.key === "clockIn" && "text-terminal-red",
          )}
          onDoubleClick={() => col.editable && isAdmin && startEdit(row._id, col.key, val ? new Date(val).toISOString().slice(11, 16) : "")}
        >
          {timeStr}
        </span>
      );
    }

    if (["breakMinutes", "netMinutes", "overtimeMinutes", "grossMinutes"].includes(col.key)) {
      const m = val ?? 0;
      return (
        <span className={cn(
          "timer-display",
          col.key === "overtimeMinutes" && m > 0 && "text-terminal-amber font-medium",
          col.key === "netMinutes" && "font-medium",
        )}>
          {formatDuration(m)}
        </span>
      );
    }

    if (col.key === "status") {
      return (
        <Badge variant="outline" className={cn("text-[7px] px-1 py-0", getStatusBg(val ?? ""))}>
          {(val ?? "").replace(/_/g, " ").toUpperCase()}
        </Badge>
      );
    }

    return <span className="truncate">{val ?? "—"}</span>;
  }, [expandedRows, editingCell, editValue, isAdmin, toggleExpand, startEdit, saveEdit, cancelEdit]);

  // ─── Loading ─────────────────────────────────────────────────

  if (!timesheet) {
    return (
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-3 space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", isFullscreen && "fixed inset-0 z-50 bg-background p-4")}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {timesheet.total} records
            {selectedRows.size > 0 && ` · ${selectedRows.size} selected`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as any)}
            className="h-6 text-[10px] border border-border rounded px-1.5 bg-background"
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setShowColConfig(!showColConfig)}>
            <Columns3 className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </Button>
          <Button variant="outline" size="sm" className="h-6 px-1.5 gap-1 text-[10px]" onClick={handleExport}>
            <Download className="w-3 h-3" /> Export
          </Button>
        </div>
      </div>

      {/* Column config */}
      {showColConfig && (
        <div className="flex flex-wrap gap-1 p-2 border border-border rounded bg-card mb-2">
          {DEFAULT_COLUMNS.filter((c) => c.key !== "expand").map((col) => (
            <button
              key={col.key}
              onClick={() => setVisibleCols((p) => { const n = new Set(p); n.has(col.key) ? n.delete(col.key) : n.add(col.key); return n; })}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] border transition-colors",
                visibleCols.has(col.key)
                  ? "bg-terminal-green/10 text-terminal-green border-terminal-green/20"
                  : "bg-background text-muted-foreground border-border"
              )}
            >
              {col.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className={cn("border border-border rounded-lg overflow-auto bg-card", isFullscreen ? "flex-1" : "max-h-[65vh]")}>
        <table className="w-full text-[11px] border-collapse" style={{ minWidth: columns.reduce((s, c) => s + c.width, 0) }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80 backdrop-blur-sm">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "text-left px-2 py-1.5 font-medium text-muted-foreground border-b border-border whitespace-nowrap",
                    col.sticky && "sticky left-0 z-20 bg-muted/80 backdrop-blur-sm",
                    col.sortable && "cursor-pointer hover:text-foreground select-none",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                  )}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div className="flex items-center gap-0.5">
                    {col.label}
                    {col.sortable && (
                      sortBy === col.key
                        ? (sortOrder === "asc" ? <ArrowUp className="w-2.5 h-2.5 text-terminal-green" /> : <ArrowDown className="w-2.5 h-2.5 text-terminal-green" />)
                        : <ArrowUpDown className="w-2.5 h-2.5 opacity-20" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timesheet.data?.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="w-8 h-8 opacity-30" />
                    <p className="text-xs">No records found</p>
                  </div>
                </td>
              </tr>
            )}
            {timesheet.data?.map((row: any) => {
              const isExpanded = expandedRows.has(row._id);
              const isSelected = selectedRows.has(row._id);
              return (
                <RowFragment key={row._id}>
                  <tr
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-muted/30",
                      isSelected && "bg-terminal-green/5",
                      row.isLate && "bg-terminal-red/5",
                    )}
                    style={{ height: rh }}
                    onContextMenu={(e) => handleCtx(e, row)}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-2 py-0.5 whitespace-nowrap",
                          col.sticky && "sticky left-0 bg-inherit z-10",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                        )}
                      >
                        {renderCell(col, row)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={columns.length} className="bg-muted/20 border-b border-border p-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[10px]">
                          <div><span className="text-muted-foreground">Scheduled:</span><p className="font-medium">{row.scheduledStart ?? "—"} – {row.scheduledEnd ?? "—"}</p></div>
                          <div><span className="text-muted-foreground">Actual:</span><p className="font-medium">
                            {row.clockIn ? new Date(row.clockIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                            {" – "}
                            {row.clockOut ? new Date(row.clockOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                          </p></div>
                          <div><span className="text-muted-foreground">Gross:</span><p className="font-medium">{formatDuration(row.grossMinutes ?? 0)}</p></div>
                          <div><span className="text-muted-foreground">Net:</span><p className="font-medium">{formatDuration(row.netMinutes ?? 0)}</p></div>
                          <div><span className="text-muted-foreground">Overtime:</span><p className="font-medium text-terminal-amber">{formatDuration(row.overtimeMinutes ?? 0)}</p></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </RowFragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => onPageChange?.(0)} disabled={page === 0}>
              <span className="text-[9px]">«</span>
            </Button>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => onPageChange?.(Math.max(0, page - 1))} disabled={page === 0}>
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => onPageChange?.(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => onPageChange?.(totalPages - 1)} disabled={page >= totalPages - 1}>
              <span className="text-[9px]">»</span>
            </Button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 250) }}
          onClick={(e) => e.stopPropagation()}
        >
          {isAdmin && (
            <>
              <CtxItem icon={Edit3} label="Edit Clock In" onClick={() => { startEdit(contextMenu.row._id, "clockIn", contextMenu.row.clockIn ? new Date(contextMenu.row.clockIn).toISOString().slice(11, 16) : ""); setContextMenu(null); }} />
              <CtxItem icon={Edit3} label="Edit Clock Out" onClick={() => { startEdit(contextMenu.row._id, "clockOut", contextMenu.row.clockOut ? new Date(contextMenu.row.clockOut).toISOString().slice(11, 16) : ""); setContextMenu(null); }} />
              <div className="h-px bg-border my-1" />
            </>
          )}
          <CtxItem icon={Eye} label="View Details" onClick={() => { onRowClick?.(contextMenu.row); setContextMenu(null); }} />
          <CtxItem icon={User} label="View Employee" onClick={() => setContextMenu(null)} />
          <CtxItem icon={Clock} label="View Timeline" onClick={() => setContextMenu(null)} />
          <CtxItem icon={AlertTriangle} label="Create Correction" onClick={() => setContextMenu(null)} />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function CtxItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-muted transition-colors text-left">
      <Icon className="w-3 h-3 text-muted-foreground" />
      {label}
    </button>
  );
}
