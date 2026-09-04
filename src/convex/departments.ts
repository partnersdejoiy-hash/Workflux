import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, logAudit } from "./helpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const depts = await ctx.db.query("departments").collect();
    const enriched = await Promise.all(
      depts.map(async (d) => {
        const employees = await ctx.db
          .query("employees")
          .withIndex("by_department", (q) => q.eq("departmentId", d._id))
          .collect();
        return { ...d, employeeCount: employees.length };
      })
    );
    return enriched;
  },
});

export const get = query({
  args: { id: v.id("departments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    description: v.optional(v.string()),
    managerId: v.optional(v.id("employees")),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("departments", {
      name: args.name,
      code: args.code,
      description: args.description,
      managerId: args.managerId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "department_created",
      entity: "department",
      entityId: id,
      newValue: JSON.stringify(args),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("departments"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    description: v.optional(v.string()),
    managerId: v.optional(v.id("employees")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() });
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "department_updated",
      entity: "department",
      entityId: id,
      newValue: JSON.stringify(filtered),
    });
    return true;
  },
});

export const remove = mutation({
  args: { id: v.id("departments") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    await ctx.db.patch(args.id, { isActive: false, updatedAt: Date.now() });
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "department_deactivated",
      entity: "department",
      entityId: args.id,
    });
    return true;
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("departments").collect();
    return all.filter((d) => d.isActive).length;
  },
});
