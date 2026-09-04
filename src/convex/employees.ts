import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { hasEmployeeManagementAccess, requireAuth, getCurrentEmployee, logAudit } from "./helpers";

export const list = query({
  args: {
    departmentId: v.optional(v.id("departments")),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let results;

    if (args.departmentId) {
      results = await ctx.db
        .query("employees")
        .withIndex("by_department", (q) => q.eq("departmentId", args.departmentId!))
        .collect();
    } else if (args.status) {
      results = await ctx.db
        .query("employees")
        .withIndex("by_status", (q) => q.eq("employmentStatus", args.status as any))
        .collect();
    } else {
      results = await ctx.db.query("employees").collect();
    }

    // Enrich with department name
    const enriched = await Promise.all(
      results.map(async (emp) => {
        const dept = await ctx.db.get(emp.departmentId);
        const team = emp.teamId ? await ctx.db.get(emp.teamId) : null;
        const designation = emp.designationId ? await ctx.db.get(emp.designationId) : null;
        const manager = emp.managerId ? await ctx.db.get(emp.managerId) : null;
        const user = await ctx.db.get(emp.userId);
        return {
          ...emp,
          departmentName: dept?.name ?? "Unknown",
          teamName: team?.name,
          designationName: designation?.name,
          managerName: manager ? `${manager.firstName} ${manager.lastName}` : undefined,
          userName: user?.name,
          userImage: user?.image,
        };
      })
    );

    let filtered = enriched;
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = enriched.filter(
        (e) =>
          e.firstName.toLowerCase().includes(s) ||
          e.lastName.toLowerCase().includes(s) ||
          e.employeeId.toLowerCase().includes(s) ||
          e.email.toLowerCase().includes(s)
      );
    }

    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

export const get = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const emp = await ctx.db.get(args.employeeId);
    if (!emp) return null;
    const dept = await ctx.db.get(emp.departmentId);
    const team = emp.teamId ? await ctx.db.get(emp.teamId) : null;
    const designation = emp.designationId ? await ctx.db.get(emp.designationId) : null;
    const manager = emp.managerId ? await ctx.db.get(emp.managerId) : null;
    const user = await ctx.db.get(emp.userId);
    return {
      ...emp,
      departmentName: dept?.name ?? "Unknown",
      teamName: team?.name,
      designationName: designation?.name,
      managerName: manager ? `${manager.firstName} ${manager.lastName}` : undefined,
      userName: user?.name,
      userImage: user?.image,
    };
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employees")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) return null;
    const dept = await ctx.db.get(employee.departmentId);
    const team = employee.teamId ? await ctx.db.get(employee.teamId) : null;
    const designation = employee.designationId ? await ctx.db.get(employee.designationId) : null;
    const manager = employee.managerId ? await ctx.db.get(employee.managerId) : null;
    return {
      ...employee,
      departmentName: dept?.name ?? "Unknown",
      teamName: team?.name,
      designationName: designation?.name,
      managerName: manager ? `${manager.firstName} ${manager.lastName}` : undefined,
    };
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    employeeId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    departmentId: v.id("departments"),
    teamId: v.optional(v.id("teams")),
    designationId: v.optional(v.id("designations")),
    managerId: v.optional(v.id("employees")),
    joiningDate: v.number(),
    payType: v.union(v.literal("hourly"), v.literal("salary")),
    hourlyRate: v.optional(v.number()),
    monthlySalary: v.optional(v.number()),
    overtimeMultiplier: v.optional(v.number()),
    holidayMultiplier: v.optional(v.number()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId: authUserId, user } = await requireAuth(ctx);
    if (!hasEmployeeManagementAccess(user.role)) {
      throw new Error("Insufficient permissions");
    }

    // Check for duplicate employee ID
    const existing = await ctx.db
      .query("employees")
      .withIndex("by_employee_id", (q) => q.eq("employeeId", args.employeeId))
      .first();
    if (existing) throw new Error("Employee ID already exists");

    const now = Date.now();
    const empId = await ctx.db.insert("employees", {
      userId: args.userId,
      employeeId: args.employeeId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      departmentId: args.departmentId,
      teamId: args.teamId,
      designationId: args.designationId,
      managerId: args.managerId,
      joiningDate: args.joiningDate,
      employmentStatus: "active",
      payType: args.payType,
      hourlyRate: args.hourlyRate,
      monthlySalary: args.monthlySalary,
      overtimeMultiplier: args.overtimeMultiplier ?? 1.5,
      holidayMultiplier: args.holidayMultiplier ?? 2.0,
      timezone: args.timezone ?? "UTC",
      createdAt: now,
      updatedAt: now,
    });

    // Update user role to employee
    await ctx.db.patch(args.userId, { role: "employee" });

    await logAudit(ctx, {
      userId: authUserId,
      userRole: user.role ?? "unknown",
      action: "employee_created",
      entity: "employee",
      entityId: empId,
      newValue: JSON.stringify({ employeeId: args.employeeId, name: `${args.firstName} ${args.lastName}` }),
    });

    return empId;
  },
});

export const update = mutation({
  args: {
    id: v.id("employees"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    teamId: v.optional(v.id("teams")),
    designationId: v.optional(v.id("designations")),
    managerId: v.optional(v.id("employees")),
    payType: v.optional(v.union(v.literal("hourly"), v.literal("salary"))),
    hourlyRate: v.optional(v.number()),
    monthlySalary: v.optional(v.number()),
    employmentStatus: v.optional(v.string()),
    overtimeMultiplier: v.optional(v.number()),
    holidayMultiplier: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId: authUserId, user } = await requireAuth(ctx);
    if (!hasEmployeeManagementAccess(user.role)) {
      throw new Error("Insufficient permissions");
    }

    const emp = await ctx.db.get(args.id);
    if (!emp) throw new Error("Employee not found");

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    const previousValue = JSON.stringify(emp);
    await ctx.db.patch(id, { ...filteredUpdates, updatedAt: Date.now() });

    await logAudit(ctx, {
      userId: authUserId,
      userRole: user.role ?? "unknown",
      action: "employee_updated",
      entity: "employee",
      entityId: id,
      previousValue,
      newValue: JSON.stringify(filteredUpdates),
    });

    return true;
  },
});

export const count = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      const results = await ctx.db
        .query("employees")
        .withIndex("by_status", (q) => q.eq("employmentStatus", args.status as any))
        .collect();
      return results.length;
    }
    const all = await ctx.db.query("employees").collect();
    return all.length;
  },
});
