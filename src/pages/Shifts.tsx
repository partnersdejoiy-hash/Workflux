import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, Moon, Sun, Calendar } from "lucide-react";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Shifts() {
  const shifts = useQuery(api.shifts.list, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Shifts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{shifts?.length ?? 0} shifts</p>
        </div>
        <Button className="gap-2 self-start bg-terminal-green hover:bg-terminal-green/90 text-white">
          <Plus className="w-3.5 h-3.5" /> Create Shift
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shifts?.map((shift) => (
          <Card key={shift._id} className="terminal-card hover:bg-muted/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded bg-terminal-amber/10 flex items-center justify-center">
                  {shift.isOvernight ? <Moon className="w-5 h-5 text-terminal-amber" /> : <Clock className="w-5 h-5 text-terminal-amber" />}
                </div>
                <Badge variant="outline" className="text-[9px]">{shift.code}</Badge>
              </div>
              <h3 className="text-sm font-medium">{shift.name}</h3>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sun className="w-3 h-3" /> {shift.startTime} — {shift.endTime}
                  {shift.isOvernight && <Badge variant="outline" className="text-[8px] ml-1">Overnight</Badge>}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Grace: {shift.gracePeriodMinutes}min | Min Hours: {shift.minimumWorkingHours}h | OT after: {shift.overtimeThresholdHours}h
                </p>
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-border">
                {dayNames.map((day, i) => (
                  <span
                    key={day}
                    className={`text-[9px] px-1 py-0.5 rounded ${
                      shift.workingDays.includes(i)
                        ? "bg-terminal-green/10 text-terminal-green"
                        : "bg-muted text-muted-foreground/50"
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
