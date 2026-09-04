import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn, msToHMS } from "@/lib/utils";
import { X, History, Inbox, ScrollText, RefreshCw } from "lucide-react";

interface Props {
  onClose?: () => void;
}

const EVENT_LABEL: Record<string, string> = {
  SHIFT_STARTED: "Shift started",
  SHIFT_ENDED: "Shift ended",
  BREAK_STARTED: "Break started",
  BREAK_ENDED: "Break ended",
  ACTIVITY_STARTED: "Activity",
  ACTIVITY_ENDED: "Activity ended",
  CLOCK_ADJUSTED: "Clock adjusted",
  MANUAL_ADJUSTMENT: "Manual adjustment",
  CORRECTION_REQUESTED: "Correction requested",
  CORRECTION_APPROVED: "Correction approved",
  CORRECTION_REJECTED: "Correction rejected",
};

const DOT_COLOR: Record<string, string> = {
  SHIFT_STARTED: "bg-terminal-green",
  SHIFT_ENDED: "bg-terminal-red",
  BREAK_STARTED: "bg-terminal-amber",
  BREAK_ENDED: "bg-terminal-amber",
  ACTIVITY_STARTED: "bg-terminal-blue",
  ACTIVITY_ENDED: "bg-terminal-blue",
  CLOCK_ADJUSTED: "bg-terminal-amber",
  MANUAL_ADJUSTMENT: "bg-terminal-amber",
};

export default function RightRail({ onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEmployee = !user?.role || user.role === "employee";
  const [tab, setTab] = useState<"logs" | "requests">("logs");

  const queueCounts = useQuery(api.requests.queueCounts);
  const today = useQuery(api.attendance.getToday);
  const sessionId = today?._id;
  const sessionEvents = useQuery(api.events.getForSession, sessionId ? { sessionId } : "skip");

  const events = useMemo(() => {
    if (!sessionEvents) return [];
    return [...sessionEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }, [sessionEvents]);

  const queue = queueCounts ?? { leave: 0, corrections: 0, adjustments: 0 };
  const pendingCount = queue.leave + queue.corrections + queue.adjustments;
  const isApprover = !isEmployee && pendingCount > 0;

  const dots = (type: string) => DOT_COLOR[type] ?? "bg-muted-foreground";

  return (
    <div className="w-80 flex-shrink-0 border-l border-border bg-card hidden 2xl:flex flex-col">
      <div className="flex items-center justify-between px-3 h-10 border-b border-border">
        <div className="flex items-center gap-0.5">
          {(["logs", "requests"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-2 py-1 text-[11px] rounded capitalize transition-colors",
                tab === t ? "bg-terminal-green/10 text-terminal-green font-medium" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t}
              {t === "requests" && pendingCount > 0 && (
                <span className="ml-1 text-[9px] bg-terminal-red text-white rounded-full px-1">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Close panel">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {tab === "logs" && (
        <div className="flex-1 overflow-auto p-3">
          {isEmployee && today?.clockIn ? (
            <>
              <div className="rounded border border-border/70 bg-muted/30 p-2.5 mb-3 space-y-1">
                <Row k="Status" v={today.status?.replace(/_/g, " ")} />
                <Row k="Clock in" v={today.clockIn ? new Date(today.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} />
                <Row k="Worked" v={today.netMinutes !== undefined ? msToHMS(today.netMinutes * 60000) : "…"} />
                <Row k="Break" v={today.breakMinutes !== undefined ? msToHMS(today.breakMinutes * 60000) : "…"} />
              </div>
              {events.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-8">
                  <History className="w-5 h-5 mx-auto mb-2 text-muted-foreground/60" />
                  Your activity timeline will appear here.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {events.map((e: any) => (
                    <div key={e._id} className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
                      <span className={cn("mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0", dots(e.type))} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-foreground leading-tight">{EVENT_LABEL[e.type] ?? e.type}</p>
                        {e.type === "ACTIVITY_STARTED" && <p className="text-[10px] text-muted-foreground truncate">{activityDesc(e)}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                        {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-8">
              <ScrollText className="w-5 h-5 mx-auto mb-2 text-muted-foreground/60" />
              {isEmployee ? "No active shift. Logs will stream here in real time." : "Open the Workflux Editor for timeline logs."}
            </p>
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="flex-1 overflow-auto p-3">
          {!isEmployee ? (
            <div className="space-y-1.5">
              <button onClick={() => navigate("/app/requests?tab=leave")} className="w-full flex items-center justify-between rounded border border-border/70 px-2.5 py-2 text-xs hover:bg-muted text-left">
                <span>Leave requests</span>
                <span className="font-mono text-terminal-amber">{queue.leave}</span>
              </button>
              <button onClick={() => navigate("/app/requests?tab=corrections")} className="w-full flex items-center justify-between rounded border border-border/70 px-2.5 py-2 text-xs hover:bg-muted text-left">
                <span>Corrections</span>
                <span className="font-mono text-terminal-amber">{queue.corrections}</span>
              </button>
              <button onClick={() => navigate("/app/requests?tab=adjustments")} className="w-full flex items-center justify-between rounded border border-border/70 px-2.5 py-2 text-xs hover:bg-muted text-left">
                <span>Time adjustments</span>
                <span className="font-mono text-terminal-amber">{queue.adjustments}</span>
              </button>
              <button onClick={() => navigate("/app/requests")} className="mt-2 w-full text-center text-[11px] text-terminal-green hover:underline">
                Open Request Center →
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-8">
              <Inbox className="w-5 h-5 mx-auto mb-2 text-muted-foreground/60" />
              Track leave, corrections and adjustments in the Request Center.
              <button onClick={() => navigate("/app/requests")} className="block mx-auto mt-2 text-terminal-green hover:underline">
                Open Request Center →
              </button>
            </p>
          )}
          {isApprover && (
            <button onClick={() => navigate("/app/requests")} className="mt-2 w-full text-center text-[11px] text-terminal-green hover:underline">
              {pendingCount} pending approval — open queue →
            </button>
          )}
        </div>
      )}

      <div className="border-t border-border px-3 py-1.5 flex items-center justify-between">
        <button onClick={() => navigate("/app/editor")} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Live via Convex
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-foreground capitalize">{v}</span>
    </div>
  );
}

function activityDesc(e: any): string {
  try {
    const val = JSON.parse(e.value ?? "{}");
    const name = val.activityName ?? val.activityTypeId;
    return name ? String(name) : "";
  } catch {
    return "";
  }
}
