import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  getCurrentEmployee,
  hasPayrollAccess,
  logAudit,
  calculateOvertime,
} from "./helpers";
import { calculateAttendance } from "./helpers";

// ─── Payroll Periods ────────────────────────────────────────────────

export const listPeriods = query({
  args: {},
  handler: async (ctx) => {
    const periods = await ctx.db.query("payrollPeriods").collect();
    periods.sort((a, b) => b.startDate - a.startDate);
    return periods;
  },
});

export const getPeriod = query({
  args: { id: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createPeriod = mutation({
  args: {
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    if (!hasPayrollAccess(user.role)) throw new Error("Insufficient permissions");

    const now = Date.now();
    const id = await ctx.db.insert("payrollPeriods", {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      userId,
      userRole: user.role ?? "unknown",
      action: "payroll_period_created",
      entity: "payrollPeriod",
      entityId: id,
      newValue: JSON.stringify(args),
    });
    return id;
  },
});

// ─── Calculate Payroll ──────────────────────────────────────────────

export const calculate = mutation({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    if (!hasPayrollAccess(user.role)) throw new Error("Insufficient permissions");

    const period = await ctx.db.get(args.periodId);
    if (!period) throw new Error("Payroll period not found");
    if (period.status === "locked" || period.status === "paid") {
      throw new Error("Payroll period is locked/paid");
    }

    // 🔐 Payroll Readiness Check
    // Before calculating, check for issues that must be resolved
    const { employee } = await getCurrentEmployee(ctx);
    
    // Check for pending corrections for employees in this period
    const pendingCorrections = await ctx.db
      .query("correctionTickets")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    
    // Check for open shifts (employees with active shift assignments in the period)
    const openShifts = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()
      .then(async (assignments) => {
        const overlapping = [];
        for (const a of assignments) {
          if (a.startDate < period.startDate || a.startDate > period.endDate) continue;
          if (a.shiftId) {
            const shift = await ctx.db.get(a.shiftId);
            if (!shift) continue;
          }
          overlapping.push(a);
        }
        return overlapping;
      });
    
    // Check for missing clock-outs (sessions with clockIn but no clockOut in the period)
    const sessionsWithMissingClockOut = employee
      ? await ctx.db
          .query("attendanceSessions")
          .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
          .collect()
          .then((sessions) => sessions.filter(
            (s) => s.clockIn && !s.clockOut && s.date >= period.startDate && s.date <= period.endDate
          ))
      : [];
    
    // Check for unresolved exceptions
    const unresolvedExceptions = await ctx.db
      .query("exceptions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect()
      .then((exceptions) => exceptions.filter(
        (e) => e.date >= period.startDate && e.date <= period.endDate
      ));

    await ctx.db.patch(args.periodId, { status: "calculating", updatedAt: Date.now() });

    // Get all active employees
    const employees = await ctx.db.query("employees").collect()
      .then((emps) => emps.filter((e) => e.employmentStatus === "active"));

    // Get all adjustments for this period
    const allAdjustments = await ctx.db
      .query("timeAdjustments")
      .collect()
      .then((a) => a.filter((adj) => {
        const adjDate = adj.createdAt;
        return adjDate >= period.startDate && adjDate <= period.endDate;
      }));

    let totalRegularHours = 0;
    let totalOvertimeHours = 0;
    let totalGross = 0;
    let totalNet = 0;

    for (const emp of employees) {
      // Get attendance sessions in period
      const sessions = await ctx.db
        .query("attendanceSessions")
        .withIndex("by_employee", (q) => q.eq("employeeId", emp._id))
        .collect();

      const periodSessions = sessions.filter(
        (s) => s.date >= period.startDate && s.date <= period.endDate && s.netMinutes
      );

      // Check for pending adjustments for this employee in this period
      const pendingAdjustments = allAdjustments.filter(
        (a) => a.employeeId === emp._id && a.status === "pending"
      );

      let totalNetMinutes = 0;
      let totalOvertimeMins = 0;

      for (const session of periodSessions) {
        // Apply any pending adjustments
        const applicableAdjustments = allAdjustments.filter(
          (a) => a.employeeId === emp._id && a.attendanceSessionId === session._id && a.status === "approved"
        );

        let effectiveClockIn = session.clockIn;
        let effectiveClockOut = session.clockOut;
        let effectiveBreakMinutes = session.breakMinutes ?? 0;
        let effectiveGrossMinutes = session.grossMinutes ?? 0;
        let effectiveNetMinutes = session.netMinutes ?? 0;
        let effectiveOvertimeMinutes = session.overtimeMinutes ?? 0;
        let effectiveStatus = session.status;
        let effectiveIsLate = session.isLate;
        let effectiveLateMinutes = session.lateMinutes;
        let effectiveIsEarlyLeave = session.isEarlyLeave;
        let effectiveEarlyLeaveMinutes = session.earlyLeaveMinutes;

        // Apply adjustments - in a full implementation, we'd merge all adjustments
        // For now, use session values (adjustments should already be applied)
        // But we track pending ones for readiness checking

        // Calculate using central engine
        const shift = session.shiftId ? await ctx.db.get(session.shiftId) : null;
        let shiftConfig = null;
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

        const breaks = session.breakMinutes ? [{
          breakStart: session.clockIn,
          durationMinutes: session.breakMinutes,
        }] : [];

        const calcResult = calculateAttendance({
          clockIn: effectiveClockIn,
          clockOut: effectiveClockOut,
          breaks,
          shift: shiftConfig ?? undefined,
          rounding: 0,
        });

        totalNetMinutes += calcResult.netMinutes;
        totalOvertimeMins += calcResult.overtimeMinutes;
      }

      const regularMinutes = totalNetMinutes - totalOvertimeMins;

      // Calculate pay using central calculation engine
      const baseRate = emp.payType === "hourly"
        ? (emp.hourlyRate ?? 0)
        : ((emp.monthlySalary ?? 0) / 160); // Assume ~160 hours/month for salary

      // Use central calculation engine for consistent formulas
      const shift = periodSessions[0]?.shiftId ? await ctx.db.get(periodSessions[0].shiftId) : null;
      let shiftConfig = null;
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

      const allBreaks = (
        await Promise.all(
          periodSessions.map(async (s) => {
            const breaks = await ctx.db
              .query("breakSessions")
              .withIndex("by_session", (q) => q.eq("attendanceSessionId", s._id))
              .collect();
            return breaks.map((b) => ({
              breakStart: b.breakStart,
              breakEnd: b.breakEnd,
              durationMinutes: b.durationMinutes,
            }));
          })
        )
      ).flat();

      const calcResult = calculateAttendance({
        clockIn: periodSessions[0]?.clockIn,
        clockOut: periodSessions[0]?.clockOut,
        breaks: allBreaks,
        shift: shiftConfig ?? undefined,
        rounding: 0,
      });

      const regularPay = (calcResult.regularMinutes / 60) * baseRate;
      const overtimePay = (calcResult.overtimeMinutes / 60) * baseRate * emp.overtimeMultiplier;
      const grossPay = regularPay + overtimePay;

      const totalRegularH = Math.round(calcResult.regularMinutes / 60 * 100) / 100;
      const totalOvertimeH = Math.round(calcResult.overtimeMinutes / 60 * 100) / 100;

      totalRegularHours += totalRegularH;
      totalOvertimeHours += totalOvertimeH;
      totalGross += grossPay;
      totalNet += grossPay; // No deductions by default

      // Create or update payroll record
      const existing = await ctx.db
        .query("payrollRecords")
        .withIndex("by_period_employee", (q) =>
          q.eq("payrollPeriodId", args.periodId).eq("employeeId", emp._id)
        )
        .first();

      const recordData = {
        payrollPeriodId: args.periodId,
        employeeId: emp._id,
        regularHours: totalRegularH,
        overtimeHours: totalOvertimeH,
        holidayHours: 0,
        paidLeaveHours: 0,
        unpaidLeaveHours: 0,
        baseRate,
        regularPay: Math.round(regularPay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        holidayPay: 0,
        grossPay: Math.round(grossPay * 100) / 100,
        allowances: 0,
        deductions: 0,
        bonuses: 0,
        adjustments: pendingAdjustments.length,
        netPay: Math.round(grossPay * 100) / 100,
        status: "calculated",
        updatedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, recordData);
      } else {
        await ctx.db.insert("payrollRecords", {
          ...recordData,
          createdAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(args.periodId, {
      status: "review",
      totalEmployees: employees.length,
      totalRegularHours: Math.round(totalRegularHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      totalGrossPay: Math.round(totalGross * 100) / 100,
      totalNetPay: Math.round(totalNet * 100) / 100,
      calculatedBy: userId,
      calculatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      userId,
      userRole: user.role ?? "unknown",
      action: "payroll_calculated",
      entity: "payrollPeriod",
      entityId: args.periodId,
      newValue: JSON.stringify({
        employees: employees.length,
        totalGross: totalGross,
        totalNet: totalNet,
      }),
    });

    return { totalEmployees: employees.length, totalGross, totalNet };
  },
});

// ─── Approve Payroll ────────────────────────────────────────────────

export const approve = mutation({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    if (!hasPayrollAccess(user.role)) throw new Error("Insufficient permissions");

    const period = await ctx.db.get(args.periodId);
    if (!period) throw new Error("Payroll period not found");
    if (period.status !== "review") throw new Error("Payroll must be in review status");

    const now = Date.now();
    await ctx.db.patch(args.periodId, {
      status: "approved",
      approvedBy: userId,
      approvedAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      userId,
      userRole: user.role ?? "unknown",
      action: "payroll_approved",
      entity: "payrollPeriod",
      entityId: args.periodId,
    });
    return true;
  },
});

// ─── Lock Payroll ───────────────────────────────────────────────────

export const lock = mutation({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    if (!hasPayrollAccess(user.role)) throw new Error("Insufficient permissions");

    const period = await ctx.db.get(args.periodId);
    if (!period) throw new Error("Payroll period not found");
    if (period.status !== "approved") throw new Error("Payroll must be approved before locking");

    const now = Date.now();
    await ctx.db.patch(args.periodId, {
      status: "locked",
      lockedBy: userId,
      lockedAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      userId,
      userRole: user.role ?? "unknown",
      action: "payroll_locked",
      entity: "payrollPeriod",
      entityId: args.periodId,
    });
    return true;
  },
});

// ─── Get Period Records ─────────────────────────────────────────────

export const getPeriodRecords = query({
  args: { periodId: v.id("payrollPeriods") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("payrollRecords")
      .withIndex("by_period", (q) => q.eq("payrollPeriodId", args.periodId))
      .collect();

    return Promise.all(
      records.map(async (r) => {
        const emp = await ctx.db.get(r.employeeId);
        const dept = emp ? await ctx.db.get(emp.departmentId) : null;
        return {
          ...r,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeIdCode: emp?.employeeId,
          departmentName: dept?.name,
        };
      })
    );
  },
});

// ─── Employee Payroll View ──────────────────────────────────────────

export const getMyPayroll = query({
  args: {},
  handler: async (ctx) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) return [];

    const records = await ctx.db
      .query("payrollRecords")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();

    return Promise.all(
      records.map(async (r) => {
        const period = await ctx.db.get(r.payrollPeriodId);
        return { ...r, period };
      })
    );
  },
});

export const getCurrentPeriod = query({
  args: {},
  handler: async (ctx) => {
    const periods = await ctx.db.query("payrollPeriods").collect();
    return periods
      .filter((p) => p.status !== "void")
      .sort((a, b) => b.startDate - a.startDate)[0] ?? null;
  },
});
