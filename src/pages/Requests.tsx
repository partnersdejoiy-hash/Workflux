import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { fmtYMDShort, formatDateTime } from "@/lib/utils";
import { CalendarPlus, CheckCircle2, XCircle, ClipboardList, SlidersHorizontal, Inbox } from "lucide-react";
import RequestLeaveDialog from "@/components/RequestLeaveDialog";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-terminal-amber/10 text-terminal-amber border-terminal-amber/20",
  approved: "bg-terminal-green/10 text-terminal-green border-terminal-green/20",
  rejected: "bg-terminal-red/10 text-terminal-red border-terminal-red/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const TYPE_LABELS: Record<string, string> = {
  sick: "Sick Leave",
  vacation: "Vacation",
  personal: "Personal",
  unpaid: "Unpaid",
  other: "Other",
  missing_clock_in: "Missing Clock In",
  missing_clock_out: "Missing Clock Out",
  wrong_clock_in: "Wrong Clock In",
  wrong_clock_out: "Wrong Clock Out",
  incorrect_break: "Incorrect Break",
  incorrect_activity: "Incorrect Activity",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_BADGE[status] ?? "bg-muted text-muted-foreground"}>
      {status}
    </Badge>
  );
}

function RequestEmpty({ title, description, action }: { title: string; description: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
        <Inbox className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && (
        <Button className="mt-4" size="sm" onClick={action.onClick}>
          <CalendarPlus className="w-4 h-4 mr-1.5" /> {action.label}
        </Button>
      )}
    </div>
  );
}

type RejectTarget =
  | { kind: "leave"; id: string }
  | { kind: "correction"; id: string }
  | { kind: "adjustment"; id: string }
  | null;

export default function Requests() {
  const { user } = useAuth();
  const isManager = !!user?.role && user.role !== "employee";
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as "leave" | "corrections" | "adjustments") ?? "leave";
  const statusFilter = searchParams.get("status") ?? "all";
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(
    searchParams.get("action") === "request-leave"
  );
  const [rejectTarget, setRejectTarget] = useState<RejectTarget>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const myProfile = useQuery(api.employees.getMyProfile);
  const myEmployeeId = myProfile?._id;

  const mgrLeaves = useQuery(api.leaves.listAll, { status: statusFilter === "all" ? undefined : statusFilter });
  const myLeaves = useQuery(api.leaves.listMy);
  const leaves = isManager ? mgrLeaves : myLeaves;

  const mgrCorrections = useQuery(api.corrections.list, { status: statusFilter === "all" ? undefined : statusFilter });
  const myCorrections = useQuery(api.corrections.getMyTickets);
  const correctionsRaw = isManager ? mgrCorrections : myCorrections;
  const corrections = correctionsRaw && "data" in (correctionsRaw ?? {}) ? (correctionsRaw as any).data : correctionsRaw;

  const adjustmentsRaw = useQuery(api.adjustments.list, {
    status: statusFilter === "all" ? undefined : statusFilter,
    employeeId: isManager ? undefined : myEmployeeId,
  });
  const adjustments = adjustmentsRaw && "data" in (adjustmentsRaw ?? {}) ? (adjustmentsRaw as any).data : adjustmentsRaw;

  const approveLeave = useMutation(api.leaves.approve);
  const rejectLeave = useMutation(api.leaves.reject);
  const cancelLeave = useMutation(api.leaves.cancel);
  const approveCorrection = useMutation(api.corrections.approve);
  const rejectCorrection = useMutation(api.corrections.reject);
  const approveAdjustment = useMutation(api.adjustments.approve);
  const rejectAdjustment = useMutation(api.adjustments.reject);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === "status" && value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const submitReject = useCallback(async () => {
    if (!rejectTarget) return;
    await run(`reject-${rejectTarget.id}`, async () => {
      if (rejectTarget.kind === "leave") {
        await rejectLeave({ leaveId: rejectTarget.id as never, note: rejectNote || undefined });
      } else if (rejectTarget.kind === "correction") {
        if (!rejectNote.trim()) throw new Error("A rejection note is required");
        await rejectCorrection({ ticketId: rejectTarget.id as never, note: rejectNote });
      } else {
        if (!rejectNote.trim()) throw new Error("A rejection reason is required");
        await rejectAdjustment({ adjustmentId: rejectTarget.id as never, reason: rejectNote });
      }
    }, "Request rejected");
    setRejectTarget(null);
  }, [rejectTarget, rejectNote, rejectLeave, rejectCorrection, rejectAdjustment, run]);

  const statusChips = ["all", "pending", "approved", "rejected"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Request Center</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Leave, attendance corrections and time adjustments — one review queue.
          </p>
        </div>
        {!isManager && (
          <Button onClick={() => setLeaveDialogOpen(true)}>
            <CalendarPlus className="w-4 h-4 mr-1.5" /> Request Leave
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParam("tab", v)}>
        <TabsList>
          <TabsTrigger value="leave"><CalendarPlus className="w-3.5 h-3.5 mr-1.5" /> Leave</TabsTrigger>
          <TabsTrigger value="corrections"><ClipboardList className="w-3.5 h-3.5 mr-1.5" /> Corrections</TabsTrigger>
          <TabsTrigger value="adjustments"><SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Time Adjustments</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-1.5">
        {statusChips.map((s) => (
          <button key={s} onClick={() => setParam("status", s)}
            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
              statusFilter === s
                ? "bg-terminal-green/10 text-terminal-green border-terminal-green/20 font-medium"
                : "text-muted-foreground border-border hover:bg-muted"
            }`}>
            {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {tab === "leave" && (
        <div className="rounded border border-border bg-card overflow-hidden">
          {leaves === undefined ? <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          : leaves.length === 0 ? (
            <RequestEmpty
              title={isManager ? "No leave requests" : "No leave requests yet"}
              description={isManager ? "Nothing waiting in the leave queue." : "Request time off and track its approval here."}
              action={!isManager ? { label: "Request Leave", onClick: () => setLeaveDialogOpen(true) } : undefined}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  {isManager && <th className="px-4 py-2 font-medium">Employee</th>}
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Dates</th>
                  <th className="px-4 py-2 font-medium">Days</th>
                  <th className="px-4 py-2 font-medium">Submitted</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(leaves as any[]).map((l) => (
                  <tr key={l._id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    {isManager && <td className="px-4 py-2">{l.employeeName}</td>}
                    <td className="px-4 py-2 capitalize">{TYPE_LABELS[l.type] ?? l.type}</td>
                    <td className="px-4 py-2">{fmtYMDShort(l.startDate)} → {fmtYMDShort(l.endDate)}</td>
                    <td className="px-4 py-2">{l.durationDays ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-2"><StatusBadge status={l.status} /></td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {l.status === "pending" && isManager && (
                        <>
                          <Button size="sm" variant="ghost" className="text-terminal-green h-7" disabled={busy !== null}
                            onClick={() => run(`al-${l._id}`, () => approveLeave({ leaveId: l._id, note: undefined }), "Leave approved")}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-terminal-red h-7" disabled={busy !== null}
                            onClick={() => setRejectTarget({ kind: "leave", id: l._id })}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {l.status === "pending" && !isManager && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground h-7" disabled={busy !== null}
                          onClick={() => run(`cl-${l._id}`, () => cancelLeave({ leaveId: l._id }), "Leave request cancelled")}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "corrections" && (
        <div className="rounded border border-border bg-card overflow-hidden">
          {corrections === undefined ? <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          : corrections.length === 0 ? (
            <RequestEmpty
              title={isManager ? "No correction requests" : "Your attendance looks clean"}
              description={isManager ? "No attendance corrections waiting for review." : "Submitted corrections will appear here."}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  {isManager && <th className="px-4 py-2 font-medium">Employee</th>}
                  <th className="px-4 py-2 font-medium">Ticket</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Requested</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(corrections as any[]).map((t: any) => (
                  <tr key={t._id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    {isManager && <td className="px-4 py-2">{t.employeeName}</td>}
                    <td className="px-4 py-2 font-mono text-xs">{t.ticketId}</td>
                    <td className="px-4 py-2 capitalize">{TYPE_LABELS[t.correctionType] ?? t.correctionType}</td>
                    <td className="px-4 py-2">{fmtYMDShort(t.date)}</td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[180px] truncate" title={t.requestedValue}>{t.requestedValue || "—"}</td>
                    <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {t.status === "pending" && isManager && (
                        <>
                          <Button size="sm" variant="ghost" className="text-terminal-green h-7" disabled={busy !== null}
                            onClick={() => run(`ac-${t._id}`, () => approveCorrection({ ticketId: t._id }), "Correction approved")}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-terminal-red h-7" disabled={busy !== null}
                            onClick={() => setRejectTarget({ kind: "correction", id: t._id })}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "adjustments" && (
        <div className="rounded border border-border bg-card overflow-hidden">
          {adjustments === undefined ? <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          : adjustments.length === 0 ? (
            <RequestEmpty
              title="No time adjustments"
              description="Field-level time changes appear here with full before/after history."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  {isManager && <th className="px-4 py-2 font-medium">Employee</th>}
                  <th className="px-4 py-2 font-medium">Field</th>
                  <th className="px-4 py-2 font-medium">Original</th>
                  <th className="px-4 py-2 font-medium">New</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(adjustments as any[]).map((a: any) => (
                  <tr key={a._id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    {isManager && <td className="px-4 py-2">{a.employeeName}</td>}
                    <td className="px-4 py-2 font-mono text-xs">{a.field}</td>
                    <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{fmtClock(a.originalValue, a.field)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{fmtClock(a.newValue, a.field)}</td>
                    <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {a.status === "pending" && isManager && (
                        <>
                          <Button size="sm" variant="ghost" className="text-terminal-green h-7" disabled={busy !== null}
                            onClick={() => run(`aa-${a._id}`, () => approveAdjustment({ adjustmentId: a._id }), "Adjustment approved & applied")}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-terminal-red h-7" disabled={busy !== null}
                            onClick={() => setRejectTarget({ kind: "adjustment", id: a._id })}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <RequestLeaveDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen} />

      <Dialog open={rejectTarget !== null} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.kind ?? "request"}</DialogTitle>
            <DialogDescription>The requester will be notified with your reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-note">Reason</Label>
            <Textarea id="reject-note" rows={3} value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Explain why this is being rejected…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy !== null || (rejectTarget?.kind !== "leave" && !rejectNote.trim())}
              onClick={submitReject}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmtClock(value: string | undefined, field: string): string {
  if (!value) return "—";
  if (field.startsWith("clock")) {
    const t = new Date(value);
    if (isNaN(t.getTime())) return value;
    return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return value;
}
