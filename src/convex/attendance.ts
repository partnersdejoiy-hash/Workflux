import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  getCurrentEmployee,
  logAudit,
  dateToYMD,
  getTodayYMD,
  parseTimeToMinutes,
  isOvernightShift,
} from "./helpers";

// ─── Get Today's Attendance ─────────────────────────────────────────

export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) return null;

    const today = getTodayYMD();
    const session = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", employee._id).eq("date", today)
      )
      .first();

    if (!session) return null;

    // Get breaks
    const breaks = await ctx.db
      .query("breakSessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect();

    // Get current activity
    const activities = await ctx.db
      .query("activitySessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect();

    const currentActivity = activities.find((a) => !a.endTime);
    const activityType = currentActivity
      ? await ctx.db.get(currentActivity.activityTypeId)
      : null;

    // Get shift info
    const shift = session.shiftId ? await ctx.db.get(session.shiftId) : null;

    return {
      ...session,
      breaks,
      activities: activities.map((a) => ({
        ...a,
        activityName: activityType?.name,
        activityCode: activityType?.code,
      })),
      currentActivity: currentActivity
        ? { ...currentActivity, activityName: activityType?.name }
        : null,
      shift,
    };
  },
});

// ─── Start Shift ────────────────────────────────────────────────────

export const startShift = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user, employee } = await getCurrentEmployee(ctx);
    if (!employee) throw new Error("Employee profile not found");

    const today = getTodayYMD();

    // Check for existing active session
    const existing = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", employee._id).eq("date", today)
      )
      .first();

    if (existing) {
      if (existing.status === "working" || existing.status === "on_break") {
        throw new Error("Shift already started");
      }
      if (existing.status === "shift_completed") {
        throw new Error("Shift already completed for today");
      }
    }

    // Get assigned shift
    const assignment = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect()
      .then((a) => a.filter((x) => x.isActive)[0]);

    const shift = assignment ? await ctx.db.get(assignment.shiftId) : null;

    // Check if late
    let isLate = false;
    let lateMinutes = 0;
    if (shift) {
      const now = new Date();
      const [sh, sm] = shift.startTime.split(":").map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(sh, sm, 0, 0);
      if (shiftStart.getTime() > now.getTime()) {
        // Not late
      } else {
        const diff = now.getTime() - shiftStart.getTime();
        const graceMs = shift.gracePeriodMinutes * 60 * 1000;
        if (diff > graceMs) {
          isLate = true;
          lateMinutes = Math.floor(diff / 60000);
        }
      }
    }

    const now = Date.now();
    let sessionId: string;

    if (existing) {
      // Update existing absent/leave record
      await ctx.db.patch(existing._id, {
        clockIn: now,
        status: isLate ? "late" : "working",
        isLate,
        lateMinutes,
        updatedAt: now,
      });
      sessionId = existing._id;
    } else {
      sessionId = await ctx.db.insert("attendanceSessions", {
        employeeId: employee._id,
        shiftId: assignment?.shiftId,
        date: today,
        clockIn: now,
        scheduledStart: shift?.startTime,
        scheduledEnd: shift?.endTime,
        status: isLate ? "late" : "working",
        isLate,
        lateMinutes,
        isEarlyLeave: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Start default activity (Internal Work or first available)
    const defaultActivity = await ctx.db
      .query("activityTypes")
      .withIndex("by_code", (q) => q.eq("code", "INTERNAL"))
      .first();

    if (defaultActivity) {
      await ctx.db.insert("activitySessions", {
        attendanceSessionId: sessionId as any,
        employeeId: employee._id,
        activityTypeId: defaultActivity._id,
        startTime: now,
        createdAt: now,
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "shift_started",
      entity: "attendanceSession",
      entityId: sessionId,
      newValue: JSON.stringify({ clockIn: new Date(now).toISOString(), isLate }),
    });

    return { sessionId, isLate, lateMinutes };
  },
});

// ─── End Shift ──────────────────────────────────────────────────────

export const endShift = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user, employee } = await getCurrentEmployee(ctx);
    if (!employee) throw new Error("Employee profile not found");

    const today = getTodayYMD();
    const session = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", employee._id).eq("date", today)
      )
      .first();

    if (!session) throw new Error("No active shift found");
    if (session.status === "shift_completed") throw new Error("Shift already completed");

    // If on break, close break first
    if (session.status === "on_break") {
      const openBreak = await ctx.db
        .query("breakSessions")
        .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
        .collect()
        .then((b) => b.filter((x) => !x.breakEnd).sort((a, b) => b.breakStart - a.breakStart)[0]);

      if (openBreak) {
        const breakEnd = Date.now();
        const durationMinutes = Math.round((breakEnd - openBreak.breakStart) / 60000);
        await ctx.db.patch(openBreak._id, { breakEnd, durationMinutes });
      }
    }

    // Close any open activity session
    const openActivities = await ctx.db
      .query("activitySessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect()
      .then((a) => a.filter((x) => !x.endTime));

    for (const act of openActivities) {
      const endTime = Date.now();
      const durationMinutes = Math.round((endTime - act.startTime) / 60000);
      await ctx.db.patch(act._id, { endTime, durationMinutes });
    }

    const clockOut = Date.now();
    const grossMinutes = Math.round((clockOut - session.clockIn) / 60000);

    // Calculate total break minutes
    const breaks = await ctx.db
      .query("breakSessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect();
    const breakMinutes = breaks.reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);

    const netMinutes = Math.max(0, grossMinutes - breakMinutes);

    // Get shift for overtime calculation
    let overtimeMinutes = 0;
    let isEarlyLeave = false;
    let earlyLeaveMinutes = 0;

    if (session.shiftId) {
      const shift = await ctx.db.get(session.shiftId);
      if (shift) {
        const thresholdMinutes = shift.overtimeThresholdHours * 60;
        overtimeMinutes = Math.max(0, netMinutes - thresholdMinutes);

        // Check early leave
        if (session.scheduledEnd) {
          const [eh, em] = session.scheduledEnd.split(":").map(Number);
          const scheduledEndMin = eh * 60 + em;
          const clockOutMin = new Date(clockOut).getHours() * 60 + new Date(clockOut).getMinutes();
          if (clockOutMin < scheduledEndMin && netMinutes < shift.minimumWorkingHours * 60) {
            isEarlyLeave = true;
            earlyLeaveMinutes = scheduledEndMin - clockOutMin;
          }
        }
      }
    }

    // Determine final status
    let finalStatus: "shift_completed" | "overtime" | "early_leave" = "shift_completed";
    if (overtimeMinutes > 0) finalStatus = "overtime";
    else if (isEarlyLeave) finalStatus = "early_leave";

    await ctx.db.patch(session._id, {
      clockOut,
      status: finalStatus,
      grossMinutes,
      breakMinutes,
      netMinutes,
      overtimeMinutes,
      isEarlyLeave,
      earlyLeaveMinutes,
      updatedAt: clockOut,
    });

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "shift_ended",
      entity: "attendanceSession",
      entityId: session._id,
      newValue: JSON.stringify({
        clockOut: new Date(clockOut).toISOString(),
        grossMinutes,
        netMinutes,
        breakMinutes,
        overtimeMinutes,
        status: finalStatus,
      }),
    });

    return {
      grossMinutes,
      breakMinutes,
      netMinutes,
      overtimeMinutes,
      status: finalStatus,
    };
  },
});

// ─── Start Break ────────────────────────────────────────────────────

export const startBreak = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user, employee } = await getCurrentEmployee(ctx);
    if (!employee) throw new Error("Employee profile not found");

    const today = getTodayYMD();
    const session = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", employee._id).eq("date", today)
      )
      .first();

    if (!session) throw new Error("No active shift");
    if (session.status === "on_break") throw new Error("Already on break");
    if (session.status === "shift_completed") throw new Error("Shift already completed");

    // Close current activity
    const openActivities = await ctx.db
      .query("activitySessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect()
      .then((a) => a.filter((x) => !x.endTime));

    for (const act of openActivities) {
      const breakTime = Date.now();
      await ctx.db.patch(act._id, {
        endTime: breakTime,
        durationMinutes: Math.round((breakTime - act.startTime) / 60000),
      });
    }

    const breakStart = Date.now();
    await ctx.db.insert("breakSessions", {
      attendanceSessionId: session._id,
      employeeId: employee._id,
      breakStart,
      createdAt: breakStart,
    });

    await ctx.db.patch(session._id, { status: "on_break", updatedAt: breakStart });

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "break_started",
      entity: "attendanceSession",
      entityId: session._id,
      newValue: JSON.stringify({ breakStart: new Date(breakStart).toISOString() }),
    });

    return true;
  },
});

// ─── End Break ──────────────────────────────────────────────────────

export const endBreak = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user, employee } = await getCurrentEmployee(ctx);
    if (!employee) throw new Error("Employee profile not found");

    const today = getTodayYMD();
    const session = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", employee._id).eq("date", today)
      )
      .first();

    if (!session) throw new Error("No active shift");
    if (session.status !== "on_break") throw new Error("Not on break");

    // Find open break
    const openBreak = await ctx.db
      .query("breakSessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect()
      .then((b) => b.filter((x) => !x.breakEnd).sort((a, b) => b.breakStart - a.breakStart)[0]);

    if (!openBreak) throw new Error("No active break found");

    const breakEnd = Date.now();
    const durationMinutes = Math.round((breakEnd - openBreak.breakStart) / 60000);
    await ctx.db.patch(openBreak._id, { breakEnd, durationMinutes });
    await ctx.db.patch(session._id, { status: "working", updatedAt: breakEnd });

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "break_ended",
      entity: "attendanceSession",
      entityId: session._id,
      newValue: JSON.stringify({ breakEnd: new Date(breakEnd).toISOString(), durationMinutes }),
    });

    return { durationMinutes };
  },
});

// ─── Change Activity ────────────────────────────────────────────────

export const changeActivity = mutation({
  args: { activityTypeId: v.id("activityTypes") },
  handler: async (ctx, args) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) throw new Error("Employee profile not found");

    const today = getTodayYMD();
    const session = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", employee._id).eq("date", today)
      )
      .first();

    if (!session) throw new Error("No active shift");
    if (session.status === "shift_completed") throw new Error("Shift completed");

    // Close current activity
    const openActivities = await ctx.db
      .query("activitySessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect()
      .then((a) => a.filter((x) => !x.endTime));

    for (const act of openActivities) {
      const now = Date.now();
      await ctx.db.patch(act._id, {
        endTime: now,
        durationMinutes: Math.round((now - act.startTime) / 60000),
      });
    }

    // Start new activity
    if (session.status !== "on_break") {
      const now = Date.now();
      await ctx.db.insert("activitySessions", {
        attendanceSessionId: session._id,
        employeeId: employee._id,
        activityTypeId: args.activityTypeId,
        startTime: now,
        createdAt: now,
      });
    }

    return true;
  },
});

// ─── Get Attendance History ─────────────────────────────────────────

export const getHistory = query({
  args: {
    employeeId: v.optional(v.id("employees")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { employee } = await getCurrentEmployee(ctx);
    const targetEmployeeId = args.employeeId ?? employee?._id;
    if (!targetEmployeeId) return [];

    let sessions = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee", (q) => q.eq("employeeId", targetEmployeeId))
      .collect();

    if (args.startDate) sessions = sessions.filter((s) => s.date >= args.startDate!);
    if (args.endDate) sessions = sessions.filter((s) => s.date <= args.endDate!);

    sessions.sort((a, b) => b.date - a.date);

    if (args.limit) sessions = sessions.slice(0, args.limit);

    return Promise.all(
      sessions.map(async (s) => {
        const shift = s.shiftId ? await ctx.db.get(s.shiftId) : null;
        const activities = await ctx.db
          .query("activitySessions")
          .withIndex("by_session", (q) => q.eq("attendanceSessionId", s._id))
          .collect();
        return { ...s, shift, activityCount: activities.length, activities };
      })
    );
  },
});

// ─── Get Timesheet Data (Admin) ─────────────────────────────────────

export const getTimesheet = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    departmentId: v.optional(v.id("departments")),
    employeeId: v.optional(v.id("employees")),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    let sessions = await ctx.db.query("attendanceSessions").collect();

    // Filter by date range
    sessions = sessions.filter((s) => s.date >= args.startDate && s.date <= args.endDate);

    // Enrich with employee and shift data
    let enriched = await Promise.all(
      sessions.map(async (s) => {
        const emp = await ctx.db.get(s.employeeId);
        const shift = s.shiftId ? await ctx.db.get(s.shiftId) : null;
        const dept = emp ? await ctx.db.get(emp.departmentId) : null;
        const activities = await ctx.db
          .query("activitySessions")
          .withIndex("by_session", (q) => q.eq("attendanceSessionId", s._id))
          .collect();
        const breaks = await ctx.db
          .query("breakSessions")
          .withIndex("by_session", (q) => q.eq("attendanceSessionId", s._id))
          .collect();
        return {
          ...s,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeIdCode: emp?.employeeId,
          departmentName: dept?.name,
          departmentId: emp?.departmentId,
          shiftName: shift?.name,
          breakCount: breaks.length,
        };
      })
    );

    // Apply filters
    if (args.departmentId) {
      enriched = enriched.filter((e) => e.departmentId === args.departmentId);
    }
    if (args.employeeId) {
      enriched = enriched.filter((e) => e.employeeId === args.employeeId);
    }
    if (args.status) {
      enriched = enriched.filter((e) => e.status === args.status);
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      enriched = enriched.filter(
        (e: any) =>
          (e.employeeName?.toLowerCase().includes(s)) ||
          (e.employeeIdCode?.toLowerCase().includes(s))
      );
    }

    // Sort
    const sortBy = args.sortBy ?? "date";
    const sortOrder = args.sortOrder ?? "desc";
    enriched.sort((a: any, b: any) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    const total = enriched.length;
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 25;
    const paged = enriched.slice(page * pageSize, (page + 1) * pageSize);

    return { data: paged, total, page, pageSize };
  },
});

// ─── Get Live Attendance (Admin) ────────────────────────────────────

export const getLiveAttendance = query({
  args: {},
  handler: async (ctx) => {
    const today = getTodayYMD();
    const sessions = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const emp = s.employeeId ? await ctx.db.get(s.employeeId) : null;
        const shift = s.shiftId ? await ctx.db.get(s.shiftId) : null;
        const dept = emp ? await ctx.db.get(emp.departmentId) : null;
        const activities = await ctx.db
          .query("activitySessions")
          .withIndex("by_session", (q) => q.eq("attendanceSessionId", s._id))
          .collect();
        const currentActivity = activities.find((a) => !a.endTime);
        const activityType = currentActivity
          ? await ctx.db.get(currentActivity.activityTypeId)
          : null;

        return {
          ...s,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeIdCode: emp?.employeeId,
          departmentName: dept?.name,
          shiftName: shift?.name,
          currentActivityName: activityType?.name,
        };
      })
    );

    return enriched;
  },
});

// ─── Get My Attendance History ──────────────────────────────────────

export const getMyHistory = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) return [];

    const days = args.days ?? 30;
    const sessions = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();

    sessions.sort((a, b) => b.date - a.date);
    return sessions.slice(0, days);
  },
});

// ─── Stats for Dashboard ────────────────────────────────────────────

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const today = getTodayYMD();
    const sessions = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    const allEmployees = await ctx.db.query("employees").collect();
    const activeEmployees = allEmployees.filter((e) => e.employmentStatus === "active");

    let working = 0;
    let onBreak = 0;
    let notStarted = 0;
    let completed = 0;
    let totalHours = 0;
    let overtimeHours = 0;

    const sessionMap = new Map<string, typeof sessions[0]>();
    for (const s of sessions) {
      sessionMap.set(s.employeeId, s);
    }

    for (const emp of activeEmployees) {
      const session = sessionMap.get(emp._id);
      if (!session) {
        notStarted++;
      } else if (session.status === "working" || session.status === "late") {
        working++;
        if (session.netMinutes) totalHours += session.netMinutes;
      } else if (session.status === "on_break") {
        onBreak++;
        if (session.netMinutes) totalHours += session.netMinutes;
      } else if (session.status === "shift_completed" || session.status === "overtime" || session.status === "early_leave") {
        completed++;
        if (session.netMinutes) totalHours += session.netMinutes;
        if (session.overtimeMinutes) overtimeHours += session.overtimeMinutes;
      }
    }

    // Pending corrections
    const pendingTickets = await ctx.db
      .query("correctionTickets")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return {
      totalEmployees: activeEmployees.length,
      working,
      onBreak,
      notStarted,
      completed,
      absent: Math.max(0, activeEmployees.length - working - onBreak - notStarted - completed),
      totalHours: Math.round(totalHours / 60 * 100) / 100,
      overtimeHours: Math.round(overtimeHours / 60 * 100) / 100,
      pendingCorrections: pendingTickets.length,
    };
  },
});
