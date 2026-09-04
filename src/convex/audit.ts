import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, getCurrentEmployee } from "./helpers";

export const list = query({
  args: {
    action: v.optional(v.string()),
    entity: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let logs = await ctx.db.query("auditLogs").collect();

    if (args.action) logs = logs.filter((l) => l.action === args.action);
    if (args.entity) logs = logs.filter((l) => l.entity === args.entity);
    if (args.userId) logs = logs.filter((l) => l.userId === args.userId);
    if (args.startDate) logs = logs.filter((l) => l.timestamp >= args.startDate!);
    if (args.endDate) logs = logs.filter((l) => l.timestamp <= args.endDate!);

    logs.sort((a, b) => b.timestamp - a.timestamp);

    const total = logs.length;
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 50;
    const paged = logs.slice(page * pageSize, (page + 1) * pageSize);

    const enriched = await Promise.all(
      paged.map(async (l) => {
        const user = await ctx.db.get(l.userId);
        return { ...l, userName: user?.name, userEmail: user?.email };
      })
    );

    return { data: enriched, total, page, pageSize };
  },
});

// ─── Notifications ──────────────────────────────────────────────

export const getMyNotifications = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getCurrentEmployee(ctx);
    if (!userId) return [];

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    notifications.sort((a, b) => b.createdAt - a.createdAt);
    return notifications.slice(0, 50);
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getCurrentEmployee(ctx);
    if (!userId) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("isRead", false))
      .collect();

    return unread.length;
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { isRead: true });
    return true;
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getCurrentEmployee(ctx);
    if (!userId) return false;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("isRead", false))
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { isRead: true });
    }
    return true;
  },
});

// ─── Enhanced audit actions list ─────────────────────────────────

export const getActionTypes = query({
  args: {},
  handler: async () => {
    return [
      "shift_started",
      "shift_ended",
      "break_started",
      "break_ended",
      "activity_created",
      "activity_updated",
      "employee_created",
      "employee_updated",
      "department_created",
      "department_updated",
      "team_created",
      "team_updated",
      "shift_created",
      "shift_updated",
      "shift_assigned",
      "ticket_created",
      "ticket_approved",
      "ticket_rejected",
      "adjustment_created",
      "adjustment_approved",
      "adjustment_rejected",
      "adjustment_quick_applied",
      "payroll_calculated",
      "payroll_approved",
      "payroll_locked",
      "setting_updated",
      "holiday_added",
      "holiday_removed",
      "attendance_corrected",
      "login",
    ];
  },
});
