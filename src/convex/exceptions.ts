import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, getCurrentEmployee, getTodayYMD, dateToYMD } from "./helpers";
import { calculateAttendance, type ShiftConfig } from "./calc";

// ═══════════════════════════════════════════════════════════════════
// WORKFLUX 2.0 — EXCEPTION DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════

export const EXCEPTION_TYPES = {
  MISSING_CLOCK_IN: "missing_clock_in",
  MISSING_CLOCK_OUT: "missing_clock_out",
  LONG_BREAK: "long_break",
  SHORT_HOURS: "short_hours",
  LATE_ARRIVAL: "late_arrival",
  EARLY_DEPARTURE: "early_departure",
  OVERTIME: "overtime",
  NO_ACTIVITY: "no_activity",
  SHIFT_WITHOUT_ACTIVITY: "shift_without_activity",
  MISSING_CLOCK_IN_OUT: "missing_clock_in_out",
} as const;

// ─── Run exception scan for a date range ────────────────────────

export const scanExceptions = mutation({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);

    const activeEmployees = await ctx.db.query("employees").collect()
      .then((emps) => emps.filter((e) => e.employmentStatus === "active"));

    let created = 0;

    for (const emp of activeEmployees) {
      // Get all attendance sessions in range
      const sessions = await ctx.db
        .query("attendanceSessions")
        .withIndex("by_employee", (q) => q.eq("employeeId", emp._id))
        .collect();

      const inRange = sessions.filter(
        (s) => s.date >= args.startDate && s.date <= args.endDate
      );

      // Get active shift assignment
      const assignment = await ctx.db
        .query("shiftAssignments")
        .withIndex("by_employee", (q) => q.eq("employeeId", emp._id))
        .collect()
        .then((a) => a.filter((x) => x.isActive)[0]);

      const shift = assignment ? await ctx.db.get(assignment.shiftId) : null;

      for (const session of inRange) {
        // Check for missing clock-in and clock-out
        if (!session.clockIn) {
          await createException(ctx, emp._id, session._id, session.date,
            EXCEPTION_TYPES.MISSING_CLOCK_IN, "critical",
            "No clock-in recorded for this attendance session",
            undefined, undefined);
          created++;
        }

        if (session.clockIn && !session.clockOut) {
          await createException(ctx, emp._id, session._id, session.date,
            EXCEPTION_TYPES.MISSING_CLOCK_OUT, "critical",
            "Clock-in recorded but no clock-out — shift still open",
            undefined, undefined);
          created++;
        }

        if (!session.clockIn && !session.clockOut) {
          await createException(ctx, emp._id, session._id, session.date,
            EXCEPTION_TYPES.MISSING_CLOCK_IN_OUT, "critical",
            "No attendance recorded for a working day",
            undefined, undefined);
          created++;
        }

        // Check exceptions that need completed sessions
        if (session.clockIn && session.clockOut && session.netMinutes !== undefined) {
          // Long break
          if (session.breakMinutes && shift && session.breakMinutes > shift.breakMinutes + 15) {
            await createException(ctx, emp._id, session._id, session.date,
              EXCEPTION_TYPES.LONG_BREAK, "warning",
              `Break of ${session.breakMinutes} min exceeds allowed ${shift.breakMinutes} min`,
              `${shift.breakMinutes}`, `${session.breakMinutes}`);
            created++;
          }

          // Short hours
          if (shift && session.netMinutes < shift.minimumWorkingHours * 60) {
            await createException(ctx, emp._id, session._id, session.date,
              EXCEPTION_TYPES.SHORT_HOURS, "warning",
              `Worked ${Math.round(session.netMinutes / 60 * 10) / 10}h, minimum is ${shift.minimumWorkingHours}h`,
              `${shift.minimumWorkingHours}h`, `${Math.round(session.netMinutes / 60 * 10) / 10}h`);
            created++;
          }

          // Late arrival
          if (session.isLate && session.lateMinutes) {
            await createException(ctx, emp._id, session._id, session.date,
              EXCEPTION_TYPES.LATE_ARRIVAL, "warning",
              `Arrived ${session.lateMinutes} minutes late`,
              shift?.startTime, undefined);
            created++;
          }

          // Early departure
          if (session.isEarlyLeave && session.earlyLeaveMinutes) {
            await createException(ctx, emp._id, session._id, session.date,
              EXCEPTION_TYPES.EARLY_DEPARTURE, "warning",
              `Left ${session.earlyLeaveMinutes} minutes early`,
              shift?.endTime, undefined);
            created++;
          }

          // Overtime
          if (session.overtimeMinutes && session.overtimeMinutes > 0) {
            await createException(ctx, emp._id, session._id, session.date,
              EXCEPTION_TYPES.OVERTIME, "info",
              `${Math.round(session.overtimeMinutes / 60 * 10) / 10}h overtime logged`,
              `${shift?.overtimeThresholdHours}h threshold`, `${Math.round(session.netMinutes / 60 * 10) / 10}h total`);
            created++;
          }

          // No activity
          const activities = await ctx.db
            .query("activitySessions")
            .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
            .collect();

          if (activities.length === 0) {
            await createException(ctx, emp._id, session._id, session.date,
              EXCEPTION_TYPES.NO_ACTIVITY, "warning",
              "No activities recorded for this shift",
              undefined, undefined);
            created++;
          }
        }
      }
    }

    return { scanned: activeEmployees.length, exceptionsCreated: created };
  },
});

// ─── Helper: create exception (skip duplicates) ─────────────────

async function createException(
  ctx: { db: any },
  employeeId: string,
  sessionId: string | undefined,
  date: number,
  type: string,
  severity: string,
  description: string,
  expectedValue: string | undefined,
  actualValue: string | undefined,
) {
  // Check for existing exception of same type for same session
  if (sessionId) {
    const existing = await ctx.db
      .query("exceptions")
      .withIndex("by_employee", (q: any) => q.eq("employeeId", employeeId))
      .collect();

    const duplicate = existing.find(
      (e: any) => e.type === type && e.attendanceSessionId === sessionId && e.status === "open"
    );
    if (duplicate) return;
  }

  const now = Date.now();
  await ctx.db.insert("exceptions", {
    employeeId,
    attendanceSessionId: sessionId,
    date,
    type,
    severity,
    description,
    expectedValue,
    actualValue,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
}

// ─── Queries ─────────────────────────────────────────────────────

export const list = query({
  args: {
    status: v.optional(v.string()),
    severity: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let exceptions = await ctx.db.query("exceptions").collect();

    if (args.status) exceptions = exceptions.filter((e) => e.status === args.status);
    if (args.severity) exceptions = exceptions.filter((e) => e.severity === args.severity);
    if (args.employeeId) exceptions = exceptions.filter((e) => e.employeeId === args.employeeId);
    if (args.startDate) exceptions = exceptions.filter((e) => e.date >= args.startDate!);
    if (args.endDate) exceptions = exceptions.filter((e) => e.date <= args.endDate!);

    exceptions.sort((a, b) => b.createdAt - a.createdAt);

    const total = exceptions.length;
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 25;
    const paged = exceptions.slice(page * pageSize, (page + 1) * pageSize);

    const enriched = await Promise.all(
      paged.map(async (e) => {
        const emp = await ctx.db.get(e.employeeId);
        return {
          ...e,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeIdCode: emp?.employeeId,
        };
      })
    );

    return { data: enriched, total, page, pageSize };
  },
});

export const getCounts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("exceptions").collect();
    const open = all.filter((e) => e.status === "open");

    return {
      total: all.length,
      open: open.length,
      critical: open.filter((e) => e.severity === "critical").length,
      warning: open.filter((e) => e.severity === "warning").length,
      info: open.filter((e) => e.severity === "info").length,
    };
  },
});

export const resolve = mutation({
  args: {
    exceptionId: v.id("exceptions"),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    await ctx.db.patch(args.exceptionId, {
      status: "resolved",
      resolvedBy: userId,
      resolvedAt: now,
      resolution: args.resolution,
      updatedAt: now,
    });

    return true;
  },
});

export const ignore = mutation({
  args: { exceptionId: v.id("exceptions") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    await ctx.db.patch(args.exceptionId, {
      status: "ignored",
      resolvedBy: userId,
      resolvedAt: now,
      updatedAt: now,
    });

    return true;
  },
});
