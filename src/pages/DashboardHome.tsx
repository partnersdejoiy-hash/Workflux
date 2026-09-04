import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration, fmtYMDShort } from "@/lib/utils";
import {
  Play,
  Coffee,
  Activity,
  Square,
  CalendarPlus,
  Inbox,
  ClipboardList,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  ArrowRight,
  History,
  Zap,
} from "lucide-react";
import RequestLeaveDialog from "@/components/RequestLeaveDialog";

const EVENT_LABEL: Record<string, string> = {
  SHIFT_STARTED: "Shift started",
  SHIFT_ENDED: "Shift ended",
  BREAK_STARTED: "Break started",
  BREAK_ENDED: "Break ended",
  ACTIVITY_STARTED: "Activity",
  CLOCK_ADJUSTED: "Clock adjusted",
  CORRECTION_APPROVED: "Correction approved",
  CORRECTION_REJECTED: "Correction rejected",
};

export default function DashboardHome() {
  const { user } = useAuth();
  if (!user) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  const isEmployee = !user.role || user.role === "employee";
  return isEmployee ? <EmployeeHome /> : <AdminHome />;
}

/* ─── Employee control center ─────────────────────────────────── */
function EmployeeHome() {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const today = useQuery(api.attendance.getToday);
  const myLeaves = useQuery(api.leaves.listMy);
  const myTickets = useQuery(api.corrections.getMyTickets);

  const sessionId = today?._id;
  const sessionEvents = useQuery(api.events.getForSession, sessionId ? { sessionId } : "skip");
  const events = useMemo(
    () => (sessionEvents ? [...sessionEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6) : []),
    [sessionEvents]
  );

  const pendingLeaves = (myLeaves ?? []).filter((l: any) => l.status === "pending");
  const pendingTickets = (myTickets ?? []).filter((t: any) => t.status === "pending");

  const status = today?.status?.replace(/_/g, " ") ?? "not started";

  return (
    <div className="space-y-5 max-w-5xl">
      <Header title="Dashboard" subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} />

      {/* TODAY status strip */}
      <div className="rounded border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn(
            "w-2.5 h-2.5 rounded-full",
            today?.status === "on_break" ? "bg-terminal-amber animate-pulse"
              : today?.clockIn ? "bg-terminal-green animate-pulse"
              : "bg-muted-foreground"
          )} />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current status</p>
            <p className="text-sm font-semibold capitalize">{status}</p>
          </div>
          <div className="hidden sm:block h-8 w-px bg-border mx-1" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Worked today</p>
            <p className="text-sm font-semibold">{today?.netMinutes !== undefined ? formatDuration(today.netMinutes) : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Break</p>
            <p className="text-sm font-semibold">{today?.breakMinutes !== undefined ? formatDuration(today.breakMinutes) : "—"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/app/my-shift" className="inline-flex items-center gap-1 px-3 h-8 rounded border border-border text-xs hover:bg-muted">
            <Play className="w-3.5 h-3.5 text-terminal-green" /> Shift controls <ArrowRight className="w-3 h-3" />
          </Link>
          <button onClick={() => setLeaveOpen(true)} className="inline-flex items-center gap-1 px-3 h-8 rounded border border-border text-xs hover:bg-muted">
            <CalendarPlus className="w-3.5 h-3.5 text-terminal-green" /> Request Leave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pending requests */}
        <Section title="Pending requests" icon={Inbox} empty="Nothing pending — your attendance looks clean.">
          {pendingLeaves.map((l: any) => (
            <MiniRow key={l._id} icon={CalendarPlus} tone="amber"
              title={`${l.type} leave`} sub={`${fmtYMDShort(l.startDate)} → ${fmtYMDShort(l.endDate)}`}
              right={<Badge variant="outline" className="bg-terminal-amber/10 text-terminal-amber">pending</Badge>} />
          ))}
          {pendingTickets.map((t: any) => (
            <MiniRow key={t._id} icon={ClipboardList} tone="amber"
              title={`Correction · ${t.correctionType.replace(/_/g, " ")}`} sub={fmtYMDShort(t.date)}
              right={<Badge variant="outline" className="bg-terminal-amber/10 text-terminal-amber">pending</Badge>} />
          ))}
        </Section>

        {/* Today timeline */}
        <Section title="Today's log" icon={History} empty={today?.clockIn ? "Start an activity — events appear here live." : "Start your shift to begin your timeline."}>
          {events.map((e: any) => (
            <MiniRow key={e._id} icon={EVENT_ICON(e.type)} tone={EVENT_TONE(e.type)}
              title={EVENT_LABEL[e.type] ?? e.type}
              sub={new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
              right={undefined} />
          ))}
        </Section>

        {/* Approved / rejected history */}
        <Section title="Recent outcomes" icon={CheckCircle2} empty="No approvals or rejections yet.">
          {(myLeaves ?? []).filter((l: any) => l.status !== "pending").slice(0, 4).map((l: any) => (
            <MiniRow key={l._id} icon={l.status === "approved" ? CheckCircle2 : XCircle}
              tone={l.status === "approved" ? "green" : "red"}
              title={`${l.type} leave ${l.status}`} sub={fmtYMDShort(l.startDate)}
              right={l.approverName ? <span className="text-[10px] text-muted-foreground">{l.approverName}</span> : undefined} />
          ))}
          {(myTickets ?? []).filter((t: any) => t.status !== "pending").slice(0, 4).map((t: any) => (
            <MiniRow key={t._id} icon={t.status === "approved" ? CheckCircle2 : XCircle}
              tone={t.status === "approved" ? "green" : "red"}
              title={`Correction ${t.status}`} sub={fmtYMDShort(t.date)}
              right={undefined} />
          ))}
        </Section>
      </div>

      <RequestLeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
    </div>
  );
}

/* ─── Admin control center ────────────────────────────────────── */
function AdminHome() {
  const queue = useQuery(api.requests.queueCounts);
  const pendingLeaves = useQuery(api.leaves.listPending);
  const live = useQuery(api.attendance.getLiveAttendance);
  const stats = useQuery(api.attendance.getStats);

  const q = queue ?? { leave: 0, corrections: 0, adjustments: 0 };
  const liveSnippet = (live ?? []).slice(0, 8);
  const working = (live ?? []).filter((e: any) => e.status === "working" || e.status === "late" || e.status === "on_break");

  return (
    <div className="space-y-5">
      <Header title="Control Center" subtitle="Workforce status, queues and attention items" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QueueCard to="/app/requests?tab=leave" label="Pending leave" count={q.leave} icon={CalendarPlus} tone="amber" />
        <QueueCard to="/app/requests?tab=corrections" label="Corrections" count={q.corrections} icon={ClipboardList} tone="red" />
        <QueueCard to="/app/requests?tab=adjustments" label="Time adjustments" count={q.adjustments} icon={SlidersHorizontal} tone="blue" />
        <QueueCard to="/app/live" label="Live attendance" count={working.length} icon={Zap} tone="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Live status" icon={Zap} empty="No one is clocked in right now.">
          {liveSnippet.map((e: any) => (
            <MiniRow key={e._id} icon={e.status === "on_break" ? Coffee : e.status === "working" || e.status === "late" ? Play : Square}
              tone={e.status === "on_break" ? "amber" : e.status === "working" || e.status === "late" ? "green" : "gray"}
              title={e.name ?? "Employee"}
              sub={`${e.employeeIdCode ?? ""} · ${(e.status ?? "not_started").replace(/_/g, " ")}`}
              right={e.workedMinutes !== undefined ? <span className="text-[10px] text-muted-foreground">{formatDuration(e.workedMinutes)}</span> : undefined} />
          ))}
        </Section>

        <Section title="Newest leave requests" icon={CalendarPlus} empty="No leave requests yet.">
          {(pendingLeaves ?? []).slice(0, 6).map((l: any) => (
            <MiniRow key={l._id} icon={CalendarPlus} tone="amber"
              title={l.employeeName}
              sub={`${l.type} · ${fmtYMDShort(l.startDate)} → ${fmtYMDShort(l.endDate)}`}
              right={<Link to="/app/requests?tab=leave" className="text-[10px] text-terminal-green hover:underline">Review</Link>} />
          ))}
        </Section>
      </div>

      {stats && (
        <p className="text-[11px] text-muted-foreground">
          {stats.working} working · {stats.onBreak} on break · {stats.notStarted} not started · {stats.completed} completed · {stats.absent} absent · {stats.overtimeHours}h overtime
        </p>
      )}
    </div>
  );
}

/* ─── Small shared UI ──────────────────────────────────────────── */
function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function Section({ title, icon: Icon, empty, children }: { title: string; icon: any; empty: string; children: React.ReactNode }) {
  const hasChildren = React.Children.count(children) > 0;
  return (
    <div className="rounded border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-terminal-green" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <div className="divide-y divide-border/50">
        {hasChildren ? children : (
          <p className="px-3 py-6 text-[11px] text-muted-foreground text-center">{empty}</p>
        )}
      </div>
    </div>
  );
}

function MiniRow({ icon: Icon, tone, title, sub, right }: { icon: any; tone: "green" | "amber" | "red" | "blue" | "gray"; title: string; sub?: string; right?: React.ReactNode }) {
  const toneCls =
    tone === "green" ? "text-terminal-green" : tone === "amber" ? "text-terminal-amber"
    : tone === "red" ? "text-terminal-red" : tone === "blue" ? "text-terminal-blue" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", toneCls)} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground capitalize truncate">{title}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function QueueCard({ to, label, count, icon: Icon, tone }: { to: string; label: string; count: number; icon: any; tone: "green" | "amber" | "red" | "blue" }) {
  const toneCls = tone === "green" ? "text-terminal-green" : tone === "amber" ? "text-terminal-amber" : tone === "red" ? "text-terminal-red" : "text-terminal-blue";
  const nav = useNavigate();
  return (
    <button onClick={() => nav(to)} className="rounded border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <Icon className={cn("w-4 h-4", toneCls)} />
        <span className={cn("text-xl font-bold", toneCls)}>{count}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">{label}</p>
    </button>
  );
}

const EVENT_ICON = (t: string) =>
  t === "SHIFT_STARTED" || t === "SHIFT_ENDED" ? Play : t === "BREAK_STARTED" || t === "BREAK_ENDED" ? Coffee : t.startsWith("ACTIVITY") ? Activity : History;
const EVENT_TONE = (t: string): any =>
  t === "SHIFT_STARTED" ? "green" : t === "SHIFT_ENDED" ? "red" : t.startsWith("BREAK") ? "amber" : t.startsWith("ACTIVITY") ? "blue" : "gray";

