import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, getCurrentEmployee, getTodayYMD, logAudit } from "./helpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("activityTypes").collect();
  },
});

export const get = query({
  args: { id: v.id("activityTypes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const id = await ctx.db.insert("activityTypes", {
      ...args,
      isActive: true,
      createdBy: userId,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "activity_created",
      entity: "activityType",
      entityId: id,
      newValue: JSON.stringify(args),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("activityTypes"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
    await ctx.db.patch(id, filtered);
    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "activity_updated",
      entity: "activityType",
      entityId: id,
      newValue: JSON.stringify(filtered),
    });
    return true;
  },
});

export const getMyTimeline = query({
  args: { attendanceSessionId: v.id("attendanceSessions") },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("activitySessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", args.attendanceSessionId))
      .collect();

    return Promise.all(
      activities.map(async (a) => {
        const type = await ctx.db.get(a.activityTypeId);
        return { ...a, activityName: type?.name, activityCode: type?.code, activityColor: type?.color };
      })
    );
  },
});

export const getMyActivitiesToday = query({
  args: {},
  handler: async (ctx) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) return [];

    const today = getTodayYMD();
    
    const session = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", employee._id).eq("date", today)
      )
      .first();

    if (!session) return [];

    const activities = await ctx.db
      .query("activitySessions")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", session._id))
      .collect();

    return Promise.all(
      activities.map(async (a) => {
        const type = await ctx.db.get(a.activityTypeId);
        return { ...a, activityName: type?.name };
      })
    );
  },
});
