import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getStatusBg, msToHMS } from "@/lib/utils";
import { toast } from "sonner";
import {
  Play,
  Pause,
  Square,
  Coffee,
  Clock,
  Timer,
  Calendar,
  Activity,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

export default function EmployeeDashboard() {
  const today = useQuery(api.attendance.getToday);
  const activities = useQuery(api.activities.list);
  const myHistory = useQuery(api.attendance.getMyHistory, { days: 7 });
  const startShift = useMutation(api.attendance.startShift);
  const endShift = useMutation(api.attendance.endShift);
  const startBreak = useMutation(api.attendance.startBreak);
  const endBreak = useMutation(api.attendance.endBreak);
  const changeActivity = useMutation(api.attendance.changeActivity);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [breakElapsedMs, setBreakElapsedMs] = useState(0);

  // Live timer
  useEffect(() => {
    if (!today?.clockIn) return;

    const updateTimers = () => {
      const now = Date.now();
      // Work timer
      if (today.status === "working" || today.status === "late") {
        const breaks = today.breaks || [];
        const totalBreakMs = breaks.reduce((sum, b) => {
          const end = b.breakEnd || (b.breakStart < now ? now : b.breakStart);
          return sum + (end - b.breakStart);
        }, 0);
        setElapsedMs(now - today.clockIn - totalBreakMs);
      } else if (today.status === "shift_completed" || today.status === "overtime" || today.status === "early_leave") {
        setElapsedMs((today.netMinutes ?? 0) * 60000);
      }

      // Break timer
      if (today.status === "on_break") {
        const openBreak = today.breaks?.find((b) => !b.breakEnd);
        if (openBreak) {
          setBreakElapsedMs(now - openBreak.breakStart);
        }
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [today]);

  const handleStartShift = useCallback(async () => {
    try {
      const result = await startShift();
      if (result.isLate) {
        toast.warning(`Shift started — Late by ${result.lateMinutes} min`, {
          description: "Your attendance has been recorded as late.",
        });
      } else {
        toast.success("Shift started", {
          description: "Your shift has begun. Timer is running.",
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start shift");
    }
  }, [startShift]);

  const handleEndShift = useCallback(async () => {
    try {
      const result = await endShift();
      toast.success("Shift completed", {
        description: `Worked: ${result.netMinutes} min | Break: ${result.breakMinutes} min | Overtime: ${result.overtimeMinutes} min`,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to end shift");
    }
  }, [endShift]);

  const handleStartBreak = useCallback(async () => {
    try {
      await startBreak();
      toast.info("Break started");
    } catch (error: any) {
      toast.error(error.message || "Failed to start break");
    }
  }, [startBreak]);

  const handleEndBreak = useCallback(async () => {
    try {
      const result = await endBreak();
      toast.info(`Break ended — ${result.durationMinutes} min`);
    } catch (error: any) {
      toast.error(error.message || "Failed to end break");
    }
  }, [endBreak]);

  const handleChangeActivity = useCallback(
    async (activityId: string) => {
      try {
        await changeActivity({ activityTypeId: activityId as any });
        toast.success("Activity updated");
      } catch (error: any) {
        toast.error(error.message || "Failed to change activity");
      }
    },
    [changeActivity]
  );

  const isActive = today?.status === "working" || today?.status === "late";
  const isOnBreak = today?.status === "on_break";
  const isCompleted =
    today?.status === "shift_completed" ||
    today?.status === "overtime" ||
    today?.status === "early_leave";
  const isNotStarted = !today;

  const workedMinutes = today?.netMinutes ?? Math.floor(elapsedMs / 60000);
  const breakMinutes = today?.breakMinutes ?? Math.floor(breakElapsedMs / 60000);
  const grossMinutes = today?.grossMinutes ?? 0;

  // Calculate remaining time
  const shift = today?.shift;
  let remainingMinutes = 0;
  if (shift && today?.clockIn && !isCompleted) {
    const [endH, endM] = shift.endTime.split(":").map(Number);
    const endMinutes = endH * 60 + endM;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    remainingMinutes = Math.max(0, endMinutes - currentMinutes);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Shift</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Current Shift Card */}
      <Card className="terminal-card border-terminal-green/20">
        <CardContent className="p-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Status</p>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  isActive
                    ? "bg-terminal-green/10 text-terminal-green border-terminal-green/20"
                    : isOnBreak
                    ? "bg-terminal-amber/10 text-terminal-amber border-terminal-amber/20"
                    : isCompleted
                    ? "bg-terminal-blue/10 text-terminal-blue border-terminal-blue/20"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {isNotStarted
                  ? "NOT STARTED"
                  : isActive
                  ? "WORKING"
                  : isOnBreak
                  ? "ON BREAK"
                  : isCompleted
                  ? "SHIFT COMPLETED"
                  : today?.status?.toUpperCase()}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Shift</p>
              <p className="text-sm font-medium">
                {today?.scheduledStart ?? shift?.startTime ?? "—"} — {today?.scheduledEnd ?? shift?.endTime ?? "—"}
              </p>
            </div>
          </div>

          {/* Large Timer */}
          <div className="text-center mb-6">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
              {isOnBreak ? "Break Timer" : "Work Timer"}
            </p>
            <div
              className={cn(
                "text-5xl md:text-6xl font-bold timer-display",
                isActive ? "text-terminal-green terminal-glow" : isOnBreak ? "text-terminal-amber" : "text-muted-foreground"
              )}
            >
              {isOnBreak
                ? msToHMS(breakElapsedMs)
                : isActive
                ? msToHMS(elapsedMs)
                : isCompleted
                ? msToHMS(elapsedMs)
                : "00:00:00"}
            </div>
          </div>

          {/* Shift Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Shift Start</p>
              <p className="text-sm font-medium mt-0.5">
                {today?.clockIn
                  ? new Date(today.clockIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
                  : today?.scheduledStart ?? "—"}
              </p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Scheduled End</p>
              <p className="text-sm font-medium mt-0.5">{today?.scheduledEnd ?? shift?.endTime ?? "—"}</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Worked Today</p>
              <p className="text-sm font-medium mt-0.5 text-terminal-green">{formatMinutes(workedMinutes)}</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Break</p>
              <p className="text-sm font-medium mt-0.5 text-terminal-amber">{formatMinutes(breakMinutes)}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center">
            {isNotStarted && (
              <Button
                onClick={handleStartShift}
                className="bg-terminal-green hover:bg-terminal-green/90 text-white px-8 h-10"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Shift
              </Button>
            )}

            {isActive && (
              <>
                <Button
                  onClick={handleStartBreak}
                  variant="outline"
                  className="border-terminal-amber text-terminal-amber hover:bg-terminal-amber/10"
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Start Break
                </Button>
                <Button
                  onClick={handleEndShift}
                  variant="outline"
                  className="border-terminal-red text-terminal-red hover:bg-terminal-red/10"
                >
                  <Square className="w-4 h-4 mr-2" />
                  End Shift
                </Button>
              </>
            )}

            {isOnBreak && (
              <Button
                onClick={handleEndBreak}
                className="bg-terminal-amber hover:bg-terminal-amber/90 text-white px-8 h-10"
              >
                <Play className="w-4 h-4 mr-2" />
                Resume Work
              </Button>
            )}

            {isCompleted && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Your shift has been completed. See attendance history below.
                </p>
              </div>
            )}
          </div>

          {today?.isLate && today.lateMinutes && (
            <div className="mt-4 p-3 bg-terminal-amber/10 border border-terminal-amber/20 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-terminal-amber flex-shrink-0" />
              <p className="text-xs text-terminal-amber">
                You were {today.lateMinutes} minutes late today.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Activity */}
      {(isActive || isOnBreak) && (
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Current Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {activities?.map((act) => {
                const isCurrent = today?.currentActivity?.activityTypeId === act._id;
                return (
                  <button
                    key={act._id}
                    onClick={() => handleChangeActivity(act._id)}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs border transition-colors",
                      isCurrent
                        ? "bg-terminal-green/10 text-terminal-green border-terminal-green/20 font-medium"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {act.name}
                    {isCurrent && <span className="ml-1">●</span>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Attendance */}
      <Card className="terminal-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Recent Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Shift</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Clock In</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Clock Out</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Net Hours</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Break</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Overtime</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {myHistory?.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No attendance records yet
                    </td>
                  </tr>
                )}
                {myHistory?.map((record) => (
                  <tr key={record._id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">
                      {new Date(record.date.toString().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {record.scheduledStart ? `${record.scheduledStart}–${record.scheduledEnd}` : "—"}
                    </td>
                    <td className="px-4 py-2 timer-display">
                      {record.clockIn
                        ? new Date(record.clockIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
                        : "—"}
                    </td>
                    <td className="px-4 py-2 timer-display">
                      {record.clockOut
                        ? new Date(record.clockOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
                        : "—"}
                    </td>
                    <td className="px-4 py-2 font-medium">{formatMinutes(record.netMinutes ?? 0)}</td>
                    <td className="px-4 py-2 text-terminal-amber">{formatMinutes(record.breakMinutes ?? 0)}</td>
                    <td className="px-4 py-2 text-terminal-green">{formatMinutes(record.overtimeMinutes ?? 0)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={cn("text-[9px]", getStatusBg(record.status))}>
                        {record.status?.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}
