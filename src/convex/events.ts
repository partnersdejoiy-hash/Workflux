import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, getCurrentEmployee } from "./helpers";

// ═══════════════════════════════════════════════════════════════════
// WORKFLUX 2.0 — IMMUTABLE ATTENDANCE EVENT LOG
// ═══════════════════════════════════════════════════════════════════
// Raw attendance events are NEVER destroyed or overwritten.
// This is the historical truth for the entire timekeeping system.

export const EVENT_TYPES = {
  SHIFT_STARTED: "SHIFT_STARTED",
  SHIFT_ENDED: "SHIFT_ENDED",
  BREAK_STARTED: "BREAK_STARTED",
  BREAK_ENDED: "BREAK_ENDED",
  ACTIVITY_STARTED: "ACTIVITY_STARTED",
  ACTIVITY_ENDED: "ACTIVITY_ENDED",
  CLOCK_ADJUSTED: "CLOCK_ADJUSTED",
  CORRECTION_REQUESTED: "CORRECTION_REQUESTED",
  CORRECTION_APPROVED: "CORRECTION_APPROVED",
  CORRECTION_REJECTED: "CORRECTION_REJECTED",
  MANUAL_ADJUSTMENT: "MANUAL_ADJUSTMENT",
  PAYROLL_LOCKED: "PAYROLL_LOCKED",
} as const;

// ─── Log an event ────────────────────────────────────────────────

export const logEvent = mutation({
  args: {
    employeeId: v.id("employees"),
    attendanceSessionId: v.optional(v.id("attendanceSessions")),
    type: v.string(),
    value: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    const eventId = await ctx.db.insert("attendanceEvents", {
      employeeId: args.employeeId,
      attendanceSessionId: args.attendanceSessionId,
      type: args.type,
      timestamp: now,
      value: args.value,
      metadata: args.metadata,
      createdBy: userId,
      createdAt: now,
    });

    return eventId;
  },
});

// ─── Query events ────────────────────────────────────────────────

export const getForSession = query({
  args: { sessionId: v.id("attendanceSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attendanceEvents")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", args.sessionId))
      .collect();
  },
});

export const getForEmployee = query({
  args: {
    employeeId: v.id("employees"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let events = await ctx.db
      .query("attendanceEvents")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();

    if (args.startDate) events = events.filter((e) => e.timestamp >= args.startDate!);
    if (args.endDate) events = events.filter((e) => e.timestamp <= args.endDate!);
    if (args.type) events = events.filter((e) => e.type === args.type);

    events.sort((a, b) => b.timestamp - a.timestamp);

    if (args.limit) events = events.slice(0, args.limit);

    return events;
  },
});

export const getTimeline = query({
  args: { sessionId: v.id("attendanceSessions") },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("attendanceEvents")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", args.sessionId))
      .collect();

    events.sort((a, b) => a.timestamp - b.timestamp);

    return Promise.all(
      events.map(async (e) => {
        const user = await ctx.db.get(e.createdBy);
        return {
          ...e,
          createdByName: user?.name ?? "System",
        };
      })
    );
  },
});
