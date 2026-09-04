import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, getStatusBg, msToHMS } from "@/lib/utils";
import { PlayCircle, Coffee, Clock, CheckCircle2, Users, Eye } from "lucide-react";
import { motion } from "framer-motion";

export default function LiveAttendance() {
  const liveData = useQuery(api.attendance.getLiveAttendance);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const groups = {
    working: liveData?.filter((e) => e.status === "working" || e.status === "late") ?? [],
    on_break: liveData?.filter((e) => e.status === "on_break") ?? [],
    shift_completed: liveData?.filter((e) => ["shift_completed", "overtime", "early_leave"].includes(e.status)) ?? [],
    not_started: [] as typeof liveData extends infer T ? NonNullable<T> extends (infer U)[] ? U[] : never : never,
  };

  // Employees not in today's records are "not started"
  const groupConfig = [
    { key: "working", label: "Working", icon: PlayCircle, color: "text-terminal-green", bg: "bg-terminal-green/10" },
    { key: "on_break", label: "On Break", icon: Coffee, color: "text-terminal-amber", bg: "bg-terminal-amber/10" },
    { key: "shift_completed", label: "Completed", icon: CheckCircle2, color: "text-terminal-blue", bg: "bg-terminal-blue/10" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Live Attendance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {liveData?.length ?? 0} employees tracked today
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Live</span>
        </div>
      </div>

      {groupConfig.map(({ key, label, icon: Icon, color, bg }) => {
        const items = groups[key as keyof typeof groups] ?? [];
        return (
          <Card key={key} className="terminal-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className={cn("w-6 h-6 rounded flex items-center justify-center", bg)}>
                    <Icon className={cn("w-3.5 h-3.5", color)} />
                  </div>
                  {label}
                  <Badge variant="outline" className="text-[9px] ml-1">{items.length}</Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No employees in this category
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-3">
                  {items.map((emp) => {
                    const elapsed = emp.clockIn ? Math.floor((now - emp.clockIn) / 1000) : 0;
                    const hours = Math.floor(elapsed / 3600);
                    const mins = Math.floor((elapsed % 3600) / 60);
                    const secs = elapsed % 60;
                    const timerStr = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

                    return (
                      <div
                        key={emp._id}
                        className="p-3 rounded border border-border bg-background hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-6 h-6 rounded flex items-center justify-center", bg)}>
                              <span className={cn("text-[9px] font-bold", color)}>
                                {emp.employeeName?.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-medium leading-none">{emp.employeeName}</p>
                              <p className="text-[10px] text-muted-foreground">{emp.employeeIdCode}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn("text-[8px]", getStatusBg(emp.status))}>
                            {emp.status?.replace(/_/g, " ").toUpperCase()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                          <span className="text-muted-foreground">Dept:</span>
                          <span>{emp.departmentName}</span>
                          <span className="text-muted-foreground">Shift:</span>
                          <span>{emp.shiftName}</span>
                          {emp.currentActivityName && (
                            <>
                              <span className="text-muted-foreground">Activity:</span>
                              <span>{emp.currentActivityName}</span>
                            </>
                          )}
                          {emp.clockIn && (
                            <>
                              <span className="text-muted-foreground">Started:</span>
                              <span className="timer-display">
                                {new Date(emp.clockIn).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </span>
                            </>
                          )}
                        </div>
                        {emp.clockIn && ["working", "late", "on_break"].includes(emp.status) && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className={cn("text-lg font-bold timer-display text-center", color)}>
                              {timerStr}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </motion.div>
  );
}
