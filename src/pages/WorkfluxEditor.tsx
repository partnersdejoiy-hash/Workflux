import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn, fmtYMDInput, ymdOf, ymdFromInput, fmtYMDShort, ymdToDate, formatDateTime } from "@/lib/utils";
import {
  Play,
  Square,
  Coffee,
  Activity,
  Clock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  History,
  CalendarDays,
  ListTree,
} from "lucide-react";

const EVENT_META: Record<string, { label: string; icon: any; cls: string }> = {
  SHIFT_STARTED: { label: "Shift Started", icon: Play, cls: "text-terminal-green" },
  SHIFT_ENDED: { label: "Shift Ended", icon: Square, cls: "text-terminal-red" },
  BREAK_STARTED: { label: "Break Started", icon: Coffee, cls: "text-terminal-amber" },
  BREAK_ENDED: { label: "Break Ended", icon: Coffee, cls: "text-terminal-amber" },
  ACTIVITY_STARTED: { label: "Activity Started", icon: Activity, cls: "text-terminal-blue" },
  ACTIVITY_ENDED: { label: "Activity Ended", icon: Activity, cls: "text-terminal-blue" },
  CLOCK_ADJUSTED: { label: "Clock Adjusted", icon: Clock, cls: "text-terminal-amber" },
  MANUAL_ADJUSTMENT: { label: "Manual Adjustment", icon: Pencil, cls: "text-terminal-amber" },
  CORRECTION_REQUESTED: { label: "Correction Requested", icon: Pencil, cls: "text-muted-foreground" },
  CORRECTION_APPROVED: { label: "Correction Approved", icon: Clock, cls: "text-terminal-green" },
  CORRECTION_REJECTED: { label: "Correction Rejected", icon: Clock, cls: "text-terminal-red" },
};

function timeOf(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function describeEvent(e: any, activityNames: Map<string, string>): string {
  try {
    const val = JSON.parse(e.value ?? "{}");
    if (e.type === "ACTIVITY_STARTED" || e.type === "ACTIVITY_ENDED" || e.type === "ACTIVITY_CHANGED") {
      const name = val.activityName ?? activityNames.get(val.activityTypeId) ?? val.activityTypeId ?? "";
      return name ? `Activity — ${name}` : "Activity";
    }
    if (e.type === "BREAK_STARTED") return "Break";
    if (e.type === "BREAK_ENDED") return "Resumed";
    if (val.clockIn) return `Clock in ${new Date(val.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    if (val.clockOut) return `Clock out ${new Date(val.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return "";
  } catch {
    return "";
  }
}

function eventTime(ts: number, date: number): number {
  // Minutes since local midnight of the *selected* day
  const day = ymdToDate(date);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  return Math.floor((ts - start) / 60000);
}

export default function WorkfluxEditor() {
  const { user } = useAuth();
  const isAdmin = !!user?.role && user.role !== "employee";
  const [date, setDate] = useState(() => ymdOf(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const activities = useQuery(api.activities.list);
  const activityNames = useMemo(() => {
    const m = new Map<string, string>();
    (activities ?? []).forEach((a: any) => m.set(a._id, a.name));
    return m;
  }, [activities]);

  const history = useQuery(api.attendance.getHistory, {
    startDate: date,
    endDate: date,
    limit: 5,
  });
  const session = history?.[0];

  const timeline = useQuery(
    api.events.getTimeline,
    session ? { sessionId: session._id } : "skip"
  );
  const sessionAdjustments = useQuery(
    api.adjustments.getForSession,
    session ? { sessionId: session._id } : "skip"
  );

  const events = useMemo(
    () => (session ? (timeline ?? []).filter((e: any) => e.attendanceSessionId === session._id) : []),
    [timeline, session]
  );

  const quickApply = useMutation(api.adjustments.quickApply);
  const createCorrection = useMutation(api.corrections.create);

  const scrollToEvent = useCallback((id: string) => {
    listRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const changeDate = (delta: number) => {
    const d = ymdToDate(date);
    d.setDate(d.getDate() + delta);
    setDate(ymdOf(d));
    setSelectedEvent(null);
  };

  // ── Edit flow ────────────────────────────────────────────────────
  const openEdit = (ev: any) => {
    setSelectedEvent(ev);
    setEditOpen(true);
  };

  const canEditEvent = (ev: any) =>
    ev?.type === "SHIFT_STARTED" || ev?.type === "SHIFT_ENDED" || ev?.type === "CLOCK_ADJUSTED" || ev?.type === "MANUAL_ADJUSTMENT";

  const submitEdit = async (mode: "direct" | "request", payload: { field: string; iso: string; reason: string }) => {
    if (!session) return;
    setBusy(true);
    try {
      if (mode === "direct") {
        await quickApply({
          attendanceSessionId: session._id,
          field: payload.field,
          value: payload.iso,
          reason: payload.reason,
        });
        toast.success("Direct edit applied & audited");
      } else {
        const type = payload.field === "clockIn" ? "wrong_clock_in" : "wrong_clock_out";
        const parsed = new Date(payload.iso);
        await createCorrection({
          attendanceSessionId: session._id,
          date: session.date,
          correctionType: type as never,
          requestedValue: payload.iso,
          originalValue: JSON.stringify(
            payload.field === "clockIn" ? { clockIn: session.clockIn } : { clockOut: session.clockOut }
          ),
          reason: payload.reason,
        });
        toast.success("Change request submitted for review", {
          description: `Requested ${type.replace(/_/g, " ")} · ${timeOf(parsed.getTime())}`,
        });
      }
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to apply change");
    } finally {
      setBusy(false);
    }
  };

  const scrubberMinutes = events.map((e: any) => ({ e, min: eventTime(e.timestamp, date) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-terminal-green" /> Workflux Editor
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chronological time-to-time log · immutable events · audited changes
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => changeDate(-1)} aria-label="Previous day">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Input
            type="date"
            value={fmtYMDInput(date)}
            onChange={(e) => { const v = ymdFromInput(e.target.value); if (!isNaN(v)) setDate(v); }}
            className="h-8 w-40 text-xs"
            aria-label="Select date"
          />
          <Button variant="outline" size="sm" onClick={() => changeDate(1)} aria-label="Next day">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(ymdOf(new Date()))}>
            Today
          </Button>
        </div>
      </div>

      {!session ? (
        <div className="rounded border border-border bg-card flex flex-col items-center justify-center py-16 px-6 text-center">
          <CalendarDays className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No attendance for {fmtYMDShort(date)}</p>
          <p className="text-xs text-muted-foreground mt-1">Pick another date or start a shift — the timeline will build itself from real events.</p>
          <Button className="mt-4" size="sm" onClick={() => setDate(ymdOf(new Date()))}>Go to today</Button>
        </div>
      ) : (
        <>
          {/* TIME SCRUBBER */}
          <div className="rounded border border-border bg-card p-4">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
              <span>{fmtYMDShort(date)}</span>
              <span className="flex items-center gap-1"><ListTree className="w-3 h-3" /> {events.length} events</span>
            </div>
            <div className="relative h-8 rounded bg-muted/50" role="img" aria-label="Day timeline scrubber">
              {/* hour grid */}
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="absolute top-0 bottom-0 w-px bg-border/60" style={{ left: `${(i / 24) * 100}%` }} />
              ))}
              {/* hour labels */}
              {[0, 6, 12, 18, 24].map((h) => (
                <span key={h} className="absolute top-2 text-[9px] text-muted-foreground -translate-x-1/2"
                  style={{ left: `${(h / 24) * 100}%` }}>
                  {String(h).padStart(2, "0")}
                </span>
              ))}
              {/* event markers */}
              {scrubberMinutes.map(({ e, min }) => (
                <button
                  key={e._id}
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-background shadow-sm transition-transform hover:scale-150"
                  style={{ left: `${Math.min(99, Math.max(0.5, (min / 1440) * 100))}%`, background: markerColor(e.type) }}
                  title={`${timeOf(e.timestamp)} — ${EVENT_META[e.type]?.label ?? e.type}`}
                  aria-label={`${timeOf(e.timestamp)} ${e.type}`}
                  onClick={() => { setSelectedEvent(e); scrollToEvent(e._id); }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} /> Clock</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} /> Break</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} /> Activity</span>
            </div>
          </div>

          {/* TIMELINE */}
          <div className="rounded border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <History className="w-4 h-4 text-terminal-green" />
                <span className="font-medium text-foreground">Time-to-Time Log</span>
              </div>
              {session && (
                <span className="text-[11px] text-muted-foreground">
                  {session.clockIn ? `In ${timeOf(session.clockIn)}` : ""}
                  {session.clockOut ? ` · Out ${timeOf(session.clockOut)}` : ""}
                  {session.status ? ` · ${session.status.replace(/_/g, " ")}` : ""}
                </span>
              )}
            </div>
            {events.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No events recorded for this day yet.</p>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                {events.map((e: any, idx: number) => {
                  const meta = EVENT_META[e.type] ?? { label: e.type, icon: Clock, cls: "text-muted-foreground" };
                  const Icon = meta.icon;
                  const desc = describeEvent(e, activityNames);
                  const prev = events[idx - 1];
                  const duration = prev ? Math.round((e.timestamp - prev.timestamp) / 60000) : null;
                  return (
                    <div key={e._id} ref={(el) => { listRefs.current.set(e._id, el); }}>
                      <button
                        className={cn(
                          "w-full text-left px-4 py-2 flex items-center gap-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors",
                          selectedEvent?._id === e._id && "bg-terminal-green/[0.06]"
                        )}
                        onClick={() => setSelectedEvent(e)}
                      >
                        <span className="font-mono text-xs text-muted-foreground w-11 flex-shrink-0">{timeOf(e.timestamp)}</span>
                        <Icon className={cn("w-4 h-4 flex-shrink-0", meta.cls)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground">{meta.label}</div>
                          {desc && <div className="text-[11px] text-muted-foreground truncate">{desc}</div>}
                        </div>
                        {duration !== null && duration >= 0 && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {duration >= 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : `${duration}m`}
                          </span>
                        )}
                        <Badge variant="outline" className="flex-shrink-0 text-[9px] px-1.5 py-0 h-4">
                          {e.type}
                        </Badge>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── EVENT DETAIL DRAWER ─────────────────────────────────── */}
      <Drawer open={selectedEvent !== null && !editOpen} onOpenChange={(o) => { if (!o) setSelectedEvent(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-sm">
              {selectedEvent && (() => { const meta = EVENT_META[selectedEvent.type] ?? { label: selectedEvent.type, icon: Clock, cls: "" }; const Icon = meta.icon; return (<><Icon className={cn("w-4 h-4", meta.cls)} /> {meta.label}</>); })()}
            </DrawerTitle>
            <DrawerDescription>Immutable attendance event · {formatDateTime(selectedEvent?.timestamp ?? Date.now())}</DrawerDescription>
          </DrawerHeader>
          {selectedEvent && (
            <div className="px-6 pb-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <KV k="Timestamp" v={formatDateTime(selectedEvent.timestamp)} />
                <KV k="Event type" v={selectedEvent.type} mono />
                <KV k="Recorded by" v={selectedEvent.createdByName ?? "System"} />
                <KV k="Source" v={JSON.parse(selectedEvent.metadata ?? "{}").source ?? "app"} mono />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Event value</p>
                <pre className="rounded border border-border bg-muted/40 p-2 text-[10px] leading-4 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                  {selectedEvent.value ? JSON.stringify(JSON.parse(selectedEvent.value), null, 2) : "—"}
                </pre>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Adjustment history</p>
                {sessionAdjustments && sessionAdjustments.length > 0 ? (
                  <div className="space-y-1">
                    {(sessionAdjustments as any[]).map((a) => (
                      <div key={a._id} className="rounded border border-border/70 px-2 py-1.5 flex items-center justify-between">
                        <span className="font-mono text-[10px]">{a.field}: {fmtShortVal(a.originalValue)} → {fmtShortVal(a.newValue)}</span>
                        <Badge variant="outline" className="text-[9px] h-4">{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No adjustments recorded for this session.</p>
                )}
              </div>

              {canEditEvent(selectedEvent) && (
                <div className="rounded border border-border/70 bg-muted/30 p-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {isAdmin ? "You have direct-edit permission. Changes stay audited." : "Edits require approval — a change request will be created."}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(selectedEvent)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </div>
              )}
            </div>
          )}
          <DrawerFooter className="pt-2">
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── EDIT / REQUEST CHANGE DIALOG ────────────────────────── */}
      <EditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        isAdmin={isAdmin}
        busy={busy}
        defaultField={selectedEvent?.type === "SHIFT_ENDED" ? "clockOut" : "clockIn"}
        onSubmit={submitEdit}
      />
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("text-foreground text-right", mono && "font-mono text-[10px]")}>{v}</span>
    </>
  );
}

function fmtShortVal(v: string | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (!isNaN(d.getTime()) && v.includes("T")) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return v;
}

function markerColor(type: string): string {
  if (type.includes("BREAK")) return "#f59e0b";
  if (type.includes("ACTIVITY")) return "#3b82f6";
  if (type === "SHIFT_STARTED" || type === "SHIFT_ENDED" || type.includes("CLOCK") || type.includes("ADJUST")) return "#22c55e";
  return "#9ca3af";
}

function EditDialog({ open, onOpenChange, isAdmin, busy, defaultField, onSubmit }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  busy: boolean;
  defaultField: string;
  onSubmit: (mode: "direct" | "request", payload: { field: string; iso: string; reason: string }) => Promise<void>;
}) {
  const [field, setField] = useState(defaultField);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!value) { setError("Enter the corrected time"); return; }
    if (!reason.trim()) { setError("A reason is required"); return; }
    const iso = new Date(value).toISOString();
    await onSubmit(isAdmin ? "direct" : "request", { field, iso, reason });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setReason(""); setError(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isAdmin ? "Direct Edit" : "Request Change"}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? "Apply a direct time correction. The original value and this change are preserved in the audit trail."
              : "Submit a change request. An approver will review before anything is applied."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Field</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clockIn">Clock In</SelectItem>
                <SelectItem value="clockOut">Clock Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Corrected Time</Label>
            <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Why does this time need to change?" />
          </div>
          {error && <p className="text-xs text-terminal-red">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : isAdmin ? "Apply Direct Edit" : "Request Edit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
