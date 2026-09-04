import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, getCurrentEmployee, logAudit, hasEmployeeManagementAccess, createNotification } from "./helpers";

// ═══════════════════════════════════════════════════════════════════
// WORKFLUX 2.0 — TIME ADJUSTMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════
// All attendance edits create official adjustment records.
// Raw data is NEVER overwritten silently.

// ─── Create adjustment ───────────────────────────────────────────

export const create = mutation({
  args: {
    employeeId: v.id("employees"),
    attendanceSessionId: v.id("attendanceSessions"),
    field: v.string(),
    originalValue: v.string(),
    newValue: v.string(),
    reason: v.string(),
    adjustmentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    const now = Date.now();

    const adjustmentId = await ctx.db.insert("timeAdjustments", {
      employeeId: args.employeeId,
      attendanceSessionId: args.attendanceSessionId,
      field: args.field,
      originalValue: args.originalValue,
      newValue: args.newValue,
      reason: args.reason,
      adjustmentType: args.adjustmentType ?? "admin_edit",
      status: "pending",
      requestedBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "adjustment_created",
      entity: "timeAdjustment",
      entityId: adjustmentId,
      newValue: JSON.stringify({
        field: args.field,
        original: args.originalValue,
        new: args.newValue,
        reason: args.reason,
      }),
    });

    return adjustmentId;
  },
});

// ─── Approve adjustment ──────────────────────────────────────────

export const approve = mutation({
  args: {
    adjustmentId: v.id("timeAdjustments"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await getCurrentEmployee(ctx);
    if (!user || !hasEmployeeManagementAccess(user.role)) throw new Error("Insufficient permissions");
    const now = Date.now();

    const adjustment = await ctx.db.get(args.adjustmentId);
    if (!adjustment) throw new Error("Adjustment not found");
    if (adjustment.status !== "pending") throw new Error("Adjustment is not pending");

    await ctx.db.patch(args.adjustmentId, {
      status: "approved",
      approvedBy: userId,
      approvedAt: now,
      updatedAt: now,
    });

    // Apply the adjustment to the attendance session
    const session = await ctx.db.get(adjustment.attendanceSessionId);
    if (session) {
      const updates: Record<string, any> = { updatedAt: now };

      if (adjustment.field === "clockIn") {
        updates.clockIn = new Date(adjustment.newValue).getTime();
      } else if (adjustment.field === "clockOut") {
        updates.clockOut = new Date(adjustment.newValue).getTime();
      } else if (adjustment.field === "breakMinutes") {
        updates.breakMinutes = parseInt(adjustment.newValue);
      }

      await ctx.db.patch(adjustment.attendanceSessionId, updates);
    }

    // Notify the affected employee
    const affectedEmp = await ctx.db.get(adjustment.employeeId);
    if (affectedEmp) {
      await createNotification(ctx, {
        userId: affectedEmp.userId,
        type: "adjustment_approved",
        title: "Time Adjustment Approved",
        message: `Your ${adjustment.field} adjustment was approved and applied`,
        entityId: args.adjustmentId,
        entityType: "timeAdjustment",
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "adjustment_approved",
      entity: "timeAdjustment",
      entityId: args.adjustmentId,
      newValue: JSON.stringify({ field: adjustment.field, approved: true }),
    });

    return true;
  },
});

// ─── Reject adjustment ───────────────────────────────────────────

export const reject = mutation({
  args: {
    adjustmentId: v.id("timeAdjustments"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await getCurrentEmployee(ctx);
    if (!user || !hasEmployeeManagementAccess(user.role)) throw new Error("Insufficient permissions");
    const now = Date.now();

    const adjustment = await ctx.db.get(args.adjustmentId);
    if (!adjustment) throw new Error("Adjustment not found");
    if (adjustment.status !== "pending") throw new Error("Adjustment is not pending");

    await ctx.db.patch(args.adjustmentId, {
      status: "rejected",
      approvedBy: userId,
      approvedAt: now,
      rejectionReason: args.reason,
      updatedAt: now,
    });

    const affectedEmp = await ctx.db.get(adjustment.employeeId);
    if (affectedEmp) {
      await createNotification(ctx, {
        userId: affectedEmp.userId,
        type: "adjustment_rejected",
        title: "Time Adjustment Rejected",
        message: `Your ${adjustment.field} adjustment was rejected${args.reason ? `: ${args.reason}` : ""}`,
        entityId: args.adjustmentId,
        entityType: "timeAdjustment",
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "adjustment_rejected",
      entity: "timeAdjustment",
      entityId: args.adjustmentId,
      newValue: JSON.stringify({ rejected: true, reason: args.reason }),
    });

    return true;
  },
});

// ─── Quick apply (for authorized admins with direct-edit permission) ─

export const quickApply = mutation({
  args: {
    attendanceSessionId: v.id("attendanceSessions"),
    field: v.string(),
    value: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await getCurrentEmployee(ctx);
    if (!user || !hasEmployeeManagementAccess(user.role)) {
      throw new Error("Direct edits require manager/admin permission");
    }
    const now = Date.now();

    const session = await ctx.db.get(args.attendanceSessionId);
    if (!session) throw new Error("Session not found");

    // Get original value
    let originalValue = "";
    if (args.field === "clockIn") originalValue = new Date(session.clockIn).toISOString();
    else if (args.field === "clockOut") originalValue = session.clockOut ? new Date(session.clockOut).toISOString() : "";
    else if (args.field === "breakMinutes") originalValue = String(session.breakMinutes ?? 0);

    // Create adjustment record (status: approved)
    const adjustmentId = await ctx.db.insert("timeAdjustments", {
      employeeId: session.employeeId,
      attendanceSessionId: args.attendanceSessionId,
      field: args.field,
      originalValue,
      newValue: args.value,
      reason: args.reason,
      adjustmentType: "admin_edit",
      status: "approved",
      requestedBy: userId,
      approvedBy: userId,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Apply to session
    const updates: Record<string, any> = { updatedAt: now };
    if (args.field === "clockIn") {
      updates.clockIn = new Date(args.value).getTime();
    } else if (args.field === "clockOut") {
      updates.clockOut = new Date(args.value).getTime();
    } else if (args.field === "breakMinutes") {
      updates.breakMinutes = parseInt(args.value);
    }
    await ctx.db.patch(args.attendanceSessionId, updates);

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "adjustment_quick_applied",
      entity: "timeAdjustment",
      entityId: adjustmentId,
      previousValue: originalValue,
      newValue: args.value,
    });

    return adjustmentId;
  },
});

// ─── Queries ─────────────────────────────────────────────────────

export const list = query({
  args: {
    status: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, employee } = await getCurrentEmployee(ctx);
    const isApprover = !!user && hasEmployeeManagementAccess(user.role);
    // Non-approvers may only ever see their own adjustments.
    const requestedId = isApprover ? args.employeeId : employee?._id;
    if (!isApprover && !employee) return { data: [], total: 0, page: args.page ?? 0, pageSize: args.pageSize ?? 25 };

    let adjustments = await ctx.db.query("timeAdjustments").collect();

    if (args.status) adjustments = adjustments.filter((a) => a.status === args.status);
    if (requestedId) adjustments = adjustments.filter((a) => a.employeeId === requestedId);

    adjustments.sort((a, b) => b.createdAt - a.createdAt);

    const total = adjustments.length;
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 25;
    const paged = adjustments.slice(page * pageSize, (page + 1) * pageSize);

    const enriched = await Promise.all(
      paged.map(async (a) => {
        const emp = await ctx.db.get(a.employeeId);
        const requester = await ctx.db.get(a.requestedBy);
        const approver = a.approvedBy ? await ctx.db.get(a.approvedBy) : null;
        return {
          ...a,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeIdCode: emp?.employeeId,
          requesterName: requester?.name ?? "Unknown",
          approverName: approver?.name,
        };
      })
    );

    return { data: enriched, total, page, pageSize };
  },
});

export const getForSession = query({
  args: { sessionId: v.id("attendanceSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("timeAdjustments")
      .withIndex("by_session", (q) => q.eq("attendanceSessionId", args.sessionId))
      .collect();
  },
});

export const countPending = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("timeAdjustments")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.length;
  },
});
