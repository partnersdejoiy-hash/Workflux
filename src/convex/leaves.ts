import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  getCurrentEmployee,
  logAudit,
  createNotification,
  hasEmployeeManagementAccess,
  ymdToDate,
} from "./helpers";

// ═══════════════════════════════════════════════════════════════════
// WORKFLUX — LEAVE REQUEST SYSTEM
// ═══════════════════════════════════════════════════════════════════
// Full request flow: employee requests, manager/hr/super_admin reviews.
// Every state change is audited and notifies the affected people.

export const LEAVE_TYPES = ["sick", "vacation", "personal", "unpaid", "other"] as const;
const DAY_MS = 86400000;

function canManage(role?: string): boolean {
  return hasEmployeeManagementAccess(role as never);
}

function daysBetween(startYmd: number, endYmd: number): number {
  const s = ymdToDate(startYmd).getTime();
  const e = ymdToDate(endYmd).getTime();
  return Math.max(1, Math.round((e - s) / DAY_MS) + 1);
}

async function getApprovers(ctx: any) {
  const users = await ctx.db.query("users").collect();
  return users.filter(
    (u: any) => u.role === "super_admin" || u.role === "hr_admin" || u.role === "manager"
  );
}

async function enrichLeave(ctx: any, records: any[]) {
  return Promise.all(
    records.map(async (l) => {
      const emp = await ctx.db.get(l.employeeId);
      const approver = l.approvedBy ? await ctx.db.get(l.approvedBy) : null;
      return {
        ...l,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
        employeeCode: emp?.employeeId,
        employeeEmail: emp?.email,
        approverName: approver?.name,
      };
    })
  );
}

// ─── Request leave ───────────────────────────────────────────────

export const request = mutation({
  args: {
    type: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user, employee } = await getCurrentEmployee(ctx);
    if (!employee) throw new Error("Employee profile not found");
    if (!LEAVE_TYPES.includes(args.type as never)) {
      throw new Error("Invalid leave type");
    }
    if (args.startDate > args.endDate) {
      throw new Error("Start date must be before end date");
    }

    const startMs = ymdToDate(args.startDate).getTime();
    const endMs = ymdToDate(args.endDate).getTime();

    // Block overlapping pending/approved leave
    const existing = await ctx.db
      .query("leaveRecords")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();
    const conflict = existing.find((l) => {
      if (l.status !== "pending" && l.status !== "approved") return false;
      const lStart = ymdToDate(l.startDate).getTime();
      const lEnd = ymdToDate(l.endDate).getTime();
      return startMs <= lEnd && endMs >= lStart;
    });
    if (conflict) throw new Error("You already have pending/approved leave overlapping these dates");

    const now = Date.now();
    const leaveId = await ctx.db.insert("leaveRecords", {
      employeeId: employee._id,
      type: args.type,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason,
      status: "pending",
      durationDays: daysBetween(args.startDate, args.endDate),
      createdAt: now,
      updatedAt: now,
    });

    // Notify reviewers
    const approvers = await getApprovers(ctx);
    for (const approver of approvers) {
      await createNotification(ctx, {
        userId: approver._id,
        type: "leave_requested",
        title: "New Leave Request",
        message: `${employee.firstName} ${employee.lastName} requested ${args.type} leave (${daysBetween(args.startDate, args.endDate)} day(s))`,
        entityId: leaveId,
        entityType: "leaveRecord",
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "leave_requested",
      entity: "leaveRecord",
      entityId: leaveId,
      newValue: JSON.stringify({ type: args.type, startDate: args.startDate, endDate: args.endDate }),
    });

    return leaveId;
  },
});

// ─── Approve / Reject / Cancel ───────────────────────────────────

export const approve = mutation({
  args: { leaveId: v.id("leaveRecords"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, user, employee } = await getCurrentEmployee(ctx);
    if (!user || !canManage(user.role)) throw new Error("Insufficient permissions");

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error("Leave request is not pending");

    const now = Date.now();
    await ctx.db.patch(args.leaveId, {
      status: "approved",
      approvedBy: userId,
      approvedAt: now,
      reviewNote: args.note,
      updatedAt: now,
    });

    const emp = await ctx.db.get(leave.employeeId);
    if (emp) {
      await createNotification(ctx, {
        userId: emp.userId,
        type: "leave_approved",
        title: "Leave Approved",
        message: `Your ${leave.type} leave (${leave.durationDays ?? "?"} day(s)) was approved`,
        entityId: args.leaveId,
        entityType: "leaveRecord",
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user.role ?? "unknown",
      action: "leave_approved",
      entity: "leaveRecord",
      entityId: args.leaveId,
      newValue: JSON.stringify({ reviewer: user.name ?? userId, note: args.note, reviewerEmployeeId: employee?._id }),
    });

    return true;
  },
});

export const reject = mutation({
  args: { leaveId: v.id("leaveRecords"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, user } = await getCurrentEmployee(ctx);
    if (!user || !canManage(user.role)) throw new Error("Insufficient permissions");

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error("Leave request is not pending");

    const now = Date.now();
    await ctx.db.patch(args.leaveId, {
      status: "rejected",
      approvedBy: userId,
      approvedAt: now,
      reviewNote: args.note,
      updatedAt: now,
    });

    const emp = await ctx.db.get(leave.employeeId);
    if (emp) {
      await createNotification(ctx, {
        userId: emp.userId,
        type: "leave_rejected",
        title: "Leave Rejected",
        message: `Your ${leave.type} leave request was rejected${args.note ? `: ${args.note}` : ""}`,
        entityId: args.leaveId,
        entityType: "leaveRecord",
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user.role ?? "unknown",
      action: "leave_rejected",
      entity: "leaveRecord",
      entityId: args.leaveId,
      newValue: JSON.stringify({ note: args.note }),
    });

    return true;
  },
});

export const cancel = mutation({
  args: { leaveId: v.id("leaveRecords") },
  handler: async (ctx, args) => {
    const { userId, user, employee } = await getCurrentEmployee(ctx);
    if (!employee) throw new Error("Employee profile not found");

    const leave = await ctx.db.get(args.leaveId);
    if (!leave) throw new Error("Leave request not found");
    if (leave.status !== "pending") throw new Error("Only pending requests can be cancelled");

    const isOwner = leave.employeeId === employee._id;
    const isManager = user && canManage(user.role);
    if (!isOwner && !isManager) throw new Error("Not authorized to cancel this request");

    const now = Date.now();
    await ctx.db.patch(args.leaveId, { status: "cancelled", updatedAt: now });

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "leave_cancelled",
      entity: "leaveRecord",
      entityId: args.leaveId,
      newValue: JSON.stringify({ cancelledBy: employee.employeeId }),
    });

    return true;
  },
});

// ─── Queries ─────────────────────────────────────────────────────

export const listMy = query({
  args: {},
  handler: async (ctx) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) return [];
    const records = await ctx.db
      .query("leaveRecords")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();
    records.sort((a, b) => b.createdAt - a.createdAt);
    return enrichLeave(ctx, records);
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await getCurrentEmployee(ctx);
    if (!user || !canManage(user.role)) return [];
    const records = await ctx.db
      .query("leaveRecords")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    records.sort((a, b) => b.createdAt - a.createdAt);
    return enrichLeave(ctx, records);
  },
});

export const listAll = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await getCurrentEmployee(ctx);
    if (!user || !canManage(user.role)) return [];
    let records = await ctx.db.query("leaveRecords").collect();
    if (args.status) records = records.filter((l) => l.status === args.status);
    records.sort((a, b) => b.createdAt - a.createdAt);
    return enrichLeave(ctx, records);
  },
});

export const getById = query({
  args: { leaveId: v.id("leaveRecords") },
  handler: async (ctx, args) => {
    const { employee, user } = await getCurrentEmployee(ctx);
    const leave = await ctx.db.get(args.leaveId);
    if (!leave) return null;
    const isOwner = employee && leave.employeeId === employee._id;
    const isManager = user && canManage(user.role);
    if (!isOwner && !isManager) return null;
    return (await enrichLeave(ctx, [leave]))[0];
  },
});
