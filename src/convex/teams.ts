import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, logAudit } from "./helpers";

export const list = query({
  args: { departmentId: v.optional(v.id("departments")) },
  handler: async (ctx, args) => {
    let teams = await ctx.db.query("teams").collect();
    if (args.departmentId) {
      teams = teams.filter((t) => t.departmentId === args.departmentId);
    }
    return Promise.all(
      teams.map(async (t) => {
        const dept = await ctx.db.get(t.departmentId);
        const employees = await ctx.db
          .query("employees")
          .withIndex("by_team", (q) => q.eq("teamId", t._id))
          .collect();
        return { ...t, departmentName: dept?.name, employeeCount: employees.length };
      })
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    departmentId: v.id("departments"),
    leadId: v.optional(v.id("employees")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("teams", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "team_created",
      entity: "team",
      entityId: id,
      newValue: JSON.stringify(args),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("teams"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    leadId: v.optional(v.id("employees")),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
    await ctx.db.patch(id, { ...filtered, updatedAt: Date.now() });
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "team_updated",
      entity: "team",
      entityId: id,
      newValue: JSON.stringify(filtered),
    });
    return true;
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("teams").collect();
    return all.filter((t) => t.isActive).length;
  },
});
