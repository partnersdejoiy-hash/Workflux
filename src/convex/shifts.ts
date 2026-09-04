import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, getCurrentEmployee, logAudit, parseTimeToMinutes, isOvernightShift } from "./helpers";

export const list = query({
  args: { departmentId: v.optional(v.id("departments")) },
  handler: async (ctx, args) => {
    let shifts = await ctx.db.query("shifts").collect();
    if (args.departmentId) {
      shifts = shifts.filter((s) => s.departmentId === args.departmentId || !s.departmentId);
    }
    return shifts;
  },
});

export const get = query({
  args: { id: v.id("shifts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    gracePeriodMinutes: v.optional(v.number()),
    minimumWorkingHours: v.optional(v.number()),
    overtimeThresholdHours: v.optional(v.number()),
    workingDays: v.array(v.number()),
    breakMinutes: v.optional(v.number()),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const startMin = parseTimeToMinutes(args.startTime);
    const endMin = parseTimeToMinutes(args.endTime);
    const now = Date.now();

    const id = await ctx.db.insert("shifts", {
      name: args.name,
      code: args.code,
      startTime: args.startTime,
      endTime: args.endTime,
      isOvernight: isOvernightShift(startMin, endMin),
      gracePeriodMinutes: args.gracePeriodMinutes ?? 15,
      minimumWorkingHours: args.minimumWorkingHours ?? 8,
      overtimeThresholdHours: args.overtimeThresholdHours ?? 8,
      workingDays: args.workingDays,
      breakMinutes: args.breakMinutes ?? 60,
      departmentId: args.departmentId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "shift_created",
      entity: "shift",
      entityId: id,
      newValue: JSON.stringify(args),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("shifts"),
    name: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    gracePeriodMinutes: v.optional(v.number()),
    minimumWorkingHours: v.optional(v.number()),
    overtimeThresholdHours: v.optional(v.number()),
    workingDays: v.optional(v.array(v.number())),
    breakMinutes: v.optional(v.number()),
    departmentId: v.optional(v.id("departments")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));

    if (updates.startTime || updates.endTime) {
      const shift = await ctx.db.get(id);
      if (shift) {
        const startMin = parseTimeToMinutes(updates.startTime ?? shift.startTime);
        const endMin = parseTimeToMinutes(updates.endTime ?? shift.endTime);
        filtered.isOvernight = isOvernightShift(startMin, endMin);
      }
    }

    await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() });
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "shift_updated",
      entity: "shift",
      entityId: id,
      newValue: JSON.stringify(filtered),
    });
    return true;
  },
});

// ─── Shift Assignments ──────────────────────────────────────────────

export const assignShift = mutation({
  args: {
    employeeId: v.id("employees"),
    shiftId: v.id("shifts"),
    startDate: v.number(),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);

    // Deactivate any existing active assignment for this employee
    const existing = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
    
    for (const e of existing) {
      if (e.isActive) {
        await ctx.db.patch(e._id, { isActive: false });
      }
    }

    const id = await ctx.db.insert("shiftAssignments", {
      employeeId: args.employeeId,
      shiftId: args.shiftId,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: true,
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "shift_assigned",
      entity: "shiftAssignment",
      entityId: id,
      newValue: JSON.stringify(args),
    });
    return id;
  },
});

export const getAssignments = query({
  args: {
    employeeId: v.optional(v.id("employees")),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let assignments = args.employeeId
      ? await ctx.db
          .query("shiftAssignments")
          .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId!))
          .collect()
      : await ctx.db.query("shiftAssignments").collect();

    if (args.activeOnly) {
      assignments = assignments.filter((a) => a.isActive);
    }

    return Promise.all(
      assignments.map(async (a) => {
        const shift = await ctx.db.get(a.shiftId);
        const emp = await ctx.db.get(a.employeeId);
        return {
          ...a,
          shiftName: shift?.name,
          shiftCode: shift?.code,
          shiftStart: shift?.startTime,
          shiftEnd: shift?.endTime,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : undefined,
          employeeIdCode: emp?.employeeId,
        };
      })
    );
  },
});

export const getMyAssignment = query({
  args: {},
  handler: async (ctx) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) return null;

    const assignment = await ctx.db
      .query("shiftAssignments")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect()
      .then((a) => a.filter((x) => x.isActive).sort((a, b) => b.startDate - a.startDate)[0]);

    if (!assignment) return null;
    const shift = await ctx.db.get(assignment.shiftId);
    return { ...assignment, shift };
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("shifts").collect();
    return all.filter((s) => s.isActive).length;
  },
});
