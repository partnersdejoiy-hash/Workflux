import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Play,
  Square,
  Coffee,
  CalendarPlus,
  ClipboardList,
  Zap,
  FilePenLine,
  Activity as ActivityIcon,
  CheckCircle2,
} from "lucide-react";

interface Props {
  horizontal?: boolean;
}

export default function ActionCenter({ horizontal }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEmployee = !user?.role || user.role === "employee";
  const [busy, setBusy] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const today = useQuery(api.attendance.getToday);
  const activities = useQuery(api.activities.list);
  const startShift = useMutation(api.attendance.startShift);
  const endShift = useMutation(api.attendance.endShift);
  const startBreak = useMutation(api.attendance.startBreak);
  const endBreak = useMutation(api.attendance.endBreak);
  const changeActivity = useMutation(api.attendance.changeActivity);

  const run = useCallback(async (key: string, fn: () => Promise<any>, onOk?: (r: any) => void) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r?.isLate) {
        toast.warning("Shift started", { description: `Recorded as late by ${r.lateMinutes} min` });
      } else if (r?.netMinutes !== undefined) {
        toast.success("Shift completed", { description: `Worked ${r.netMinutes} min` });
      } else {
        onOk?.(r);
      }
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const status = today?.status;
  const onBreak = status === "on_break";
  const started = !!today?.clockIn && status !== "shift_completed";
  const currentActivityId = (today as any)?.currentActivityTypeId;

  // ── Employee clock actions ────────────────────────────────────
  const employeeActions = (
    <div className={cn("space-y-1.5", horizontal && "flex flex-wrap gap-1.5 space-y-0")}>
      <ActionButton
        horizontal={horizontal}
        icon={Play}
        label="Start Shift"
        variant="green"
        visible={!started}
        loading={busy === "start"}
        disabled={busy !== null}
        onClick={() => run("start", () => startShift())}
      />
      <ActionButton
        horizontal={horizontal}
        icon={Square}
        label="End Shift"
        variant="red"
        visible={started}
        loading={busy === "end"}
        disabled={busy !== null}
        onClick={() => run("end", () => endShift())}
      />
      <ActionButton
        horizontal={horizontal}
        icon={Coffee}
        label="Start Break"
        variant="amber"
        visible={started && !onBreak}
        loading={busy === "break"}
        disabled={busy !== null}
        onClick={() => run("break", () => startBreak(), () => toast.info("Break started"))}
      />
      <ActionButton
        horizontal={horizontal}
        icon={Coffee}
        label="End Break"
        variant="amber"
        visible={onBreak}
        loading={busy === "endbreak"}
        disabled={busy !== null}
        onClick={() => run("endbreak", () => endBreak(), () => toast.success("Break ended — back to work"))}
      />
      <ActionButton
        horizontal={horizontal}
        icon={ActivityIcon}
        label={currentActivityId ? "Change Activity" : "Select Activity"}
        variant="blue"
        visible={started && !onBreak}
        loading={false}
        disabled={busy !== null}
        onClick={() => setActivityOpen(true)}
      />
      <ActionButton
        horizontal={horizontal}
        icon={CalendarPlus}
        label="Request Leave"
        visible
        loading={false}
        disabled={busy !== null}
        onClick={() => navigate("/app/requests?action=request-leave")}
      />
      <ActionButton
        horizontal={horizontal}
        icon={ClipboardList}
        label="Attendance Correction"
        visible
        loading={false}
        disabled={busy !== null}
        onClick={() => navigate("/app/corrections")}
      />
      <ActionButton
        horizontal={horizontal}
        icon={FilePenLine}
        label="Workflux Editor"
        visible
        loading={false}
        disabled={busy !== null}
        onClick={() => navigate("/app/editor")}
      />
    </div>
  );

  // ── Admin actions ─────────────────────────────────────────────
  const adminActions = (
    <div className={cn("space-y-1.5", horizontal && "flex flex-wrap gap-1.5 space-y-0")}>
      <ActionButton horizontal={horizontal} icon={Zap} label="Live Attendance" variant="green" visible loading={false} disabled={false} onClick={() => navigate("/app/live")} />
      <ActionButton horizontal={horizontal} icon={CheckCircle2} label="Approve Requests" variant="amber" visible loading={false} disabled={false} onClick={() => navigate("/app/requests")} />
      <ActionButton horizontal={horizontal} icon={ClipboardList} label="Review Corrections" visible loading={false} disabled={false} onClick={() => navigate("/app/requests?tab=corrections")} />
      <ActionButton horizontal={horizontal} icon={FilePenLine} label="Workflux Editor" visible loading={false} disabled={false} onClick={() => navigate("/app/editor")} />
    </div>
  );

  return (
    <div className={cn(!horizontal && "w-56 flex-shrink-0 border-r border-border bg-card hidden xl:flex flex-col")}>
      {!horizontal && (
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Action Center</p>
          {isEmployee && today?.clockIn && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", onBreak ? "bg-terminal-amber" : started ? "bg-terminal-green animate-pulse" : "bg-muted-foreground")} />
              <span className="text-[11px] text-muted-foreground capitalize">
                {status?.replace(/_/g, " ") ?? "Not started"}
              </span>
            </div>
          )}
        </div>
      )}
      <div className={cn("p-2", horizontal && "p-0")}>
        {isEmployee ? employeeActions : adminActions}
      </div>

      {/* Change activity dialog */}
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Activity</DialogTitle>
            <DialogDescription>
              {currentActivityId ? "Switch to a different activity." : "Pick what you are working on."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 max-h-[320px] overflow-auto">
            {(activities ?? []).map((a: any) => (
              <Button
                key={a._id}
                variant="outline"
                className="w-full justify-between"
                disabled={busy !== null}
                onClick={() => run("activity", () => changeActivity({ activityTypeId: a._id }), () => {
                  toast.success("Activity updated", { description: a.name });
                  setActivityOpen(false);
                })}
              >
                <span>{a.name}</span>
                {currentActivityId === a._id && <CheckCircle2 className="w-4 h-4 text-terminal-green" />}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionButton({ horizontal, icon: Icon, label, visible, onClick, loading, disabled, variant }: {
  horizontal?: boolean;
  icon: any;
  label: string;
  visible: boolean;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "green" | "red" | "amber" | "blue";
}) {
  if (!visible) return null;
  const color =
    variant === "green" ? "text-terminal-green" :
    variant === "red" ? "text-terminal-red" :
    variant === "amber" ? "text-terminal-amber" :
    variant === "blue" ? "text-terminal-blue" : "text-muted-foreground";
  if (horizontal) {
    return (
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClick} disabled={disabled}>
        {loading ? <span className="w-3.5 h-3.5 animate-spin rounded-full border border-current border-t-transparent mr-1" /> : <Icon className={cn("w-3.5 h-3.5 mr-1", color)} />}
        {label}
      </Button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded border border-border/70 bg-background text-xs text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
    >
      {loading ? <span className="w-3.5 h-3.5 animate-spin rounded-full border border-current border-t-transparent" /> : <Icon className={cn("w-3.5 h-3.5", color)} />}
      <span className="truncate">{label}</span>
    </button>
  );
}
