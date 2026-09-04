import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  getCurrentEmployee,
  hasPayrollAccess,
  logAudit,
  calculateOvertime,
} from "./helpers";

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

    await ctx.db.patch(args.periodId, { status: "calculating", updatedAt: Date.now() });

    // Get all active employees
    const employees = await ctx.db.query("employees").collect()
      .then((emps) => emps.filter((e) => e.employmentStatus === "active"));

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

      const totalNetMinutes = periodSessions.reduce((sum, s) => sum + (s.netMinutes ?? 0), 0);
      const totalOvertimeMins = periodSessions.reduce((sum, s) => sum + (s.overtimeMinutes ?? 0), 0);
      const regularMinutes = totalNetMinutes - totalOvertimeMins;

      // Calculate pay
      const baseRate = emp.payType === "hourly"
        ? (emp.hourlyRate ?? 0)
        : ((emp.monthlySalary ?? 0) / 160); // Assume ~160 hours/month for salary

      const regularPay = (regularMinutes / 60) * baseRate;
      const overtimePay = (totalOvertimeMins / 60) * baseRate * emp.overtimeMultiplier;
      const grossPay = regularPay + overtimePay;

      const totalRegularH = Math.round(regularMinutes / 60 * 100) / 100;
      const totalOvertimeH = Math.round(totalOvertimeMins / 60 * 100) / 100;

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
        adjustments: 0,
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
