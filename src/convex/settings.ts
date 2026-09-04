import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, logAudit } from "./helpers";

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return setting?.value;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("systemSettings").collect();
  },
});

export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description ?? existing.description,
        updatedBy: userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("systemSettings", {
        key: args.key,
        value: args.value,
        description: args.description,
        updatedBy: userId,
        updatedAt: now,
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "setting_updated",
      entity: "systemSetting",
      entityId: args.key,
      newValue: args.value,
    });

    return true;
  },
});

// ─── Holidays ───────────────────────────────────────────────────────

export const listHolidays = query({
  args: { year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (args.year) {
      return await ctx.db
        .query("holidays")
        .withIndex("by_year", (q) => q.eq("year", args.year!))
        .collect();
    }
    return await ctx.db.query("holidays").collect();
  },
});

export const addHoliday = mutation({
  args: {
    name: v.string(),
    date: v.number(),
    year: v.number(),
    isRecurring: v.optional(v.boolean()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const id = await ctx.db.insert("holidays", {
      name: args.name,
      date: args.date,
      year: args.year,
      isRecurring: args.isRecurring ?? false,
      description: args.description,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "holiday_added",
      entity: "holiday",
      entityId: id,
      newValue: JSON.stringify(args),
    });
    return id;
  },
});

export const removeHoliday = mutation({
  args: { id: v.id("holidays") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    await ctx.db.delete(args.id);
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "holiday_removed",
      entity: "holiday",
      entityId: args.id,
    });
    return true;
  },
});
