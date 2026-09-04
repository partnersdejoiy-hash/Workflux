import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireAuth,
  getCurrentEmployee,
  logAudit,
  dateToYMD,
  getTodayYMD,
  parseTimeToMinutes,
  isOvernightShift,
  generateEmployeeId,
  calculateAttendance,
} from "./helpers";
import { EVENT_TYPES, logEvent } from "./events";

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
    let { userId, user, employee } = await getCurrentEmployee(ctx);

    // Auto-create employee profile if missing
    if (!employee) {
      const now = Date.now();
      const existingCount = await ctx.db.query("employees").collect();
      const empIdStr = generateEmployeeId(existingCount.length + 1);

      // Find default department (first available)
      const defaultDept = await ctx.db.query("departments").first();
      if (!defaultDept) throw new Error("No departments configured. Please seed the database first.");

      // Find default shift (Morning Shift or first available)
      const defaultShift = await ctx.db.query("shifts").first();

      const newEmpId = await ctx.db.insert("employees", {
        userId: userId!,
        employeeId: empIdStr,
        firstName: user?.name?.split(" ")[0] || "New",
        lastName: user?.name?.split(" ").slice(1).join(" ") || "Employee",
        email: user?.email || "",
        departmentId: defaultDept._id,
        joiningDate: now,
        employmentStatus: "active",
        payType: "salary",
        monthlySalary: 50000,
        overtimeMultiplier: 1.5,
        holidayMultiplier: 2.0,
        timezone: "UTC",
        createdAt: now,
        updatedAt: now,
      });

      // Assign default shift
      if (defaultShift) {
        await ctx.db.insert("shiftAssignments", {
          employeeId: newEmpId,
          shiftId: defaultShift._id,
          startDate: now,
          isActive: true,
          createdAt: now,
        });
      }

      // Update user role
      await ctx.db.patch(userId!, { role: "employee" });

      employee = await ctx.db.get(newEmpId);
    }
    if (!employee) throw new Error("Failed to create employee profile");

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

    // Build shift config for calculation
    let shiftConfig: { startTime: string; endTime: string; isOvernight: boolean; gracePeriodMinutes: number; minimumWorkingHours: number; overtimeThresholdHours: number; breakMinutes: number } | null = null;
    if (shift) {
      shiftConfig = {
        startTime: shift.startTime,
        endTime: shift.endTime,
        isOvernight: shift.isOvernight,
        gracePeriodMinutes: shift.gracePeriodMinutes,
        minimumWorkingHours: shift.minimumWorkingHours,
        overtimeThresholdHours: shift.overtimeThresholdHours,
        breakMinutes: shift.breakMinutes ?? 60,
      };
    }

    // Calculate attendance using central engine
    const now = Date.now();

    // Determine lateness based on the assigned shift's scheduled start
    let isLate = false;
    let lateMinutes = 0;
    if (shift && shift.startTime) {
      const [hs, ms] = shift.startTime.split(":").map(Number);
      const scheduledStart = new Date();
      scheduledStart.setHours(hs, ms, 0, 0);
      const lateBy = Math.round((now - scheduledStart.getTime()) / 60000);
      const grace = Number(shift.gracePeriodMinutes ?? 0);
      if (lateBy > grace) {
        isLate = true;
        lateMinutes = lateBy - grace;
      }
    }

    let sessionId: Id<"attendanceSessions">;
    let calculationResult: { grossMinutes: number; breakMinutes: number; netMinutes: number; overtimeMinutes: number; isLate: boolean; lateMinutes: number; isEarlyLeave: boolean; earlyLeaveMinutes: number } | null = null;

    if (existing) {
      // Update existing absent/leave record - use calculation with current clock out not yet known
      // We'll calculate netMinutes later when shift ends
      await ctx.db.patch(existing._id, {
        clockIn: now,
        status: isLate ? "late" : "working",
        isLate,
        lateMinutes,
        updatedAt: now,
      });
      sessionId = existing._id;
      // Store that we have a clock-in for later calculation
    } else {
      const clockIn = now;
      sessionId = await ctx.db.insert("attendanceSessions", {
        employeeId: employee._id,
        shiftId: assignment?.shiftId,
        date: today,
        clockIn,
        scheduledStart: shift?.startTime,
        scheduledEnd: shift?.endTime,
        status: isLate ? "late" : "working",
        isLate,
        lateMinutes,
        isEarlyLeave: false,
        grossMinutes: 0,
        breakMinutes: 0,
        netMinutes: 0,
        overtimeMinutes: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Log shift started event (immutable)
    await logEvent(ctx, {
      employeeId: employee._id,
      attendanceSessionId: sessionId,
      type: EVENT_TYPES.SHIFT_STARTED,
      value: JSON.stringify({ clockIn: new Date(now).toISOString(), isLate, lateMinutes }),
      metadata: JSON.stringify({ source: "frontend", shiftId: assignment?.shiftId }),
    });

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "shift_started",
      entity: "attendanceSession",
      entityId: sessionId,
      newValue: JSON.stringify({ clockIn: new Date(now).toISOString(), isLate, lateMinutes }),
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

    // Build shift config for calculation engine
    let shiftConfig: { startTime: string; endTime: string; isOvernight: boolean; gracePeriodMinutes: number; minimumWorkingHours: number; overtimeThresholdHours: number; breakMinutes: number } | null = null;
    if (session.shiftId) {
      const shift = await ctx.db.get(session.shiftId);
      if (shift) {
        shiftConfig = {
          startTime: shift.startTime,
          endTime: shift.endTime,
          isOvernight: shift.isOvernight,
          gracePeriodMinutes: shift.gracePeriodMinutes,
          minimumWorkingHours: shift.minimumWorkingHours,
          overtimeThresholdHours: shift.overtimeThresholdHours,
          breakMinutes: shift.breakMinutes ?? 60,
        };
      }
    }

    const clockOut = Date.now();
    
    // Use central calculation engine
    const breakSessions = await ctx.db
      .query("breakSessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect();
    const breakRecords = breakSessions.map((b) => ({
      breakStart: b.breakStart,
      breakEnd: b.breakEnd,
      durationMinutes: b.durationMinutes,
    }));

    const activities = await ctx.db
      .query("activitySessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect();
    const activityRecords = await Promise.all(
      activities.map(async (a) => ({
        startTime: a.startTime,
        endTime: a.endTime,
        durationMinutes: a.durationMinutes,
        activityName: (await ctx.db.get(a.activityTypeId))?.name,
      }))
    );

    const calcResult = calculateAttendance({
      clockIn: session.clockIn,
      clockOut,
      breaks: breakRecords,
      shift: shiftConfig ?? undefined,
      rounding: 0,
    });

    const grossMinutes = calcResult.grossMinutes;
    const breakMinutes = calcResult.breakMinutes;
    const netMinutes = calcResult.netMinutes;
    const overtimeMinutes = calcResult.overtimeMinutes;
    const isEarlyLeave = calcResult.isEarlyLeave;
    const earlyLeaveMinutes = calcResult.earlyLeaveMinutes;

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

    // Log shift ended event (immutable)
    await logEvent(ctx, {
      employeeId: employee._id,
      attendanceSessionId: session._id,
      type: EVENT_TYPES.SHIFT_ENDED,
      value: JSON.stringify({
        clockOut: new Date(clockOut).toISOString(),
        grossMinutes,
        netMinutes,
        breakMinutes,
        overtimeMinutes,
        status: finalStatus,
      }),
      metadata: JSON.stringify({ source: "frontend" }),
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

    // Log break started event (immutable)
    await logEvent(ctx, {
      employeeId: employee._id,
      attendanceSessionId: session._id,
      type: EVENT_TYPES.BREAK_STARTED,
      value: JSON.stringify({ breakStart: new Date(breakStart).toISOString() }),
      metadata: JSON.stringify({ source: "frontend" }),
    });

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

    // Log break ended event (immutable)
    await logEvent(ctx, {
      employeeId: employee._id,
      attendanceSessionId: session._id,
      type: EVENT_TYPES.BREAK_ENDED,
      value: JSON.stringify({ breakEnd: new Date(breakEnd).toISOString(), durationMinutes }),
      metadata: JSON.stringify({ source: "frontend" }),
    });

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

    // If coming back from break, close the break first (resume)
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
      await ctx.db.patch(session._id, { status: "working", updatedAt: Date.now() });
    }

    // Start new activity
    const now = Date.now();
    await ctx.db.insert("activitySessions", {
      attendanceSessionId: session._id,
      employeeId: employee._id,
      activityTypeId: args.activityTypeId,
      startTime: now,
      createdAt: now,
    });

    // Log activity started event (immutable)
    await logEvent(ctx, {
      employeeId: employee._id,
      attendanceSessionId: session._id,
      type: EVENT_TYPES.ACTIVITY_STARTED,
      value: JSON.stringify({ activityTypeId: args.activityTypeId, startTime: new Date(now).toISOString() }),
      metadata: JSON.stringify({ source: "frontend" }),
    });

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
