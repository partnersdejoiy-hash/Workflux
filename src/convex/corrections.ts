import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  getCurrentEmployee,
  canApproveCorrections,
  generateTicketId,
  logAudit,
  createNotification,
} from "./helpers";

export const list = query({
  args: {
    status: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let tickets = await ctx.db.query("correctionTickets").collect();

    if (args.status) {
      tickets = tickets.filter((t) => t.status === args.status);
    }
    if (args.employeeId) {
      tickets = tickets.filter((t) => t.employeeId === args.employeeId);
    }

    tickets.sort((a, b) => b.createdAt - a.createdAt);

    const total = tickets.length;
    const page = args.page ?? 0;
    const pageSize = args.pageSize ?? 25;
    const paged = tickets.slice(page * pageSize, (page + 1) * pageSize);

    const enriched = await Promise.all(
      paged.map(async (t) => {
        const emp = await ctx.db.get(t.employeeId);
        const reviewer = t.reviewerId ? await ctx.db.get(t.reviewerId) : null;
        return {
          ...t,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeIdCode: emp?.employeeId,
          reviewerName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : undefined,
        };
      })
    );

    return { data: enriched, total, page, pageSize };
  },
});

export const getMyTickets = query({
  args: {},
  handler: async (ctx) => {
    const { employee } = await getCurrentEmployee(ctx);
    if (!employee) return [];

    const tickets = await ctx.db
      .query("correctionTickets")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .collect();

    tickets.sort((a, b) => b.createdAt - a.createdAt);
    return tickets;
  },
});

export const create = mutation({
  args: {
    attendanceSessionId: v.optional(v.id("attendanceSessions")),
    date: v.number(),
    correctionType: v.union(
      v.literal("missing_clock_in"),
      v.literal("missing_clock_out"),
      v.literal("wrong_clock_in"),
      v.literal("wrong_clock_out"),
      v.literal("incorrect_break"),
      v.literal("incorrect_activity"),
      v.literal("other")
    ),
    originalValue: v.optional(v.string()),
    requestedValue: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, user, employee } = await getCurrentEmployee(ctx);
    if (!employee) throw new Error("Employee profile not found");

    // Check for existing pending ticket for same session and type
    if (args.attendanceSessionId) {
      const existing = await ctx.db
        .query("correctionTickets")
        .withIndex("by_attendance", (q) =>
          q.eq("attendanceSessionId", args.attendanceSessionId!)
        )
        .collect();
      const pending = existing.find((t) => t.status === "pending");
      if (pending) throw new Error("Correction request already exists for this shift");
    }

    const ticketId = generateTicketId();
    const now = Date.now();

    const id = await ctx.db.insert("correctionTickets", {
      ticketId,
      employeeId: employee._id,
      attendanceSessionId: args.attendanceSessionId,
      date: args.date,
      correctionType: args.correctionType,
      originalValue: args.originalValue,
      requestedValue: args.requestedValue,
      reason: args.reason,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Notify managers/admins
    const managers = await ctx.db
      .query("employees")
      .collect()
      .then((emps) => emps.filter((e) => e.managerId === employee._id || e._id === employee.managerId));

    // Find admins
    const admins = await ctx.db.query("users").collect()
      .then((users) => users.filter((u) => u.role === "super_admin" || u.role === "hr_admin"));

    for (const admin of admins) {
      await createNotification(ctx, {
        userId: admin._id,
        type: "correction_submitted",
        title: "New Correction Request",
        message: `${employee.firstName} ${employee.lastName} submitted a correction request for ${new Date(args.date).toLocaleDateString()}`,
        entityId: id,
        entityType: "correctionTicket",
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user?.role ?? "unknown",
      action: "ticket_created",
      entity: "correctionTicket",
      entityId: id,
      newValue: JSON.stringify({ ticketId, type: args.correctionType }),
    });

    return id;
  },
});

export const approve = mutation({
  args: {
    ticketId: v.id("correctionTickets"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await getCurrentEmployee(ctx);
    if (!user || !canApproveCorrections(user.role)) {
      throw new Error("Insufficient permissions");
    }

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "pending") throw new Error("Ticket is not pending");

    // Get employee
    const emp = await ctx.db.get(ticket.employeeId);

    // Apply correction to attendance if session exists
    if (ticket.attendanceSessionId) {
      const session = await ctx.db.get(ticket.attendanceSessionId);
      if (session) {
        const previousValue = JSON.stringify(session);
        
        // Apply the correction based on type
        const updates: Record<string, any> = { updatedAt: Date.now() };
        if (ticket.correctionType === "wrong_clock_in") {
          const time = new Date(ticket.requestedValue).getTime();
          updates.clockIn = time;
        } else if (ticket.correctionType === "wrong_clock_out") {
          const time = new Date(ticket.requestedValue).getTime();
          updates.clockOut = time;
        }

        await ctx.db.patch(ticket.attendanceSessionId, updates);

        await logAudit(ctx, {
          userId,
          userRole: user.role ?? "unknown",
          action: "attendance_corrected",
          entity: "attendanceSession",
          entityId: ticket.attendanceSessionId,
          previousValue,
          newValue: JSON.stringify({ correctionType: ticket.correctionType, requestedValue: ticket.requestedValue }),
        });
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.ticketId, {
      status: "approved",
      reviewerId: emp?._id,
      reviewedAt: now,
      reviewNote: args.note,
      updatedAt: now,
    });

    // Notify employee
    if (emp) {
      await createNotification(ctx, {
        userId: emp.userId,
        type: "correction_approved",
        title: "Correction Approved",
        message: `Your correction request (${ticket.ticketId}) has been approved`,
        entityId: args.ticketId,
        entityType: "correctionTicket",
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user.role ?? "unknown",
      action: "ticket_approved",
      entity: "correctionTicket",
      entityId: args.ticketId,
      newValue: JSON.stringify({ reviewerId: emp?.employeeId, note: args.note }),
    });

    return true;
  },
});

export const reject = mutation({
  args: {
    ticketId: v.id("correctionTickets"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await getCurrentEmployee(ctx);
    if (!user || !canApproveCorrections(user.role)) {
      throw new Error("Insufficient permissions");
    }

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "pending") throw new Error("Ticket is not pending");

    const emp = await ctx.db.get(ticket.employeeId);
    const now = Date.now();

    await ctx.db.patch(args.ticketId, {
      status: "rejected",
      reviewerId: emp?._id,
      reviewedAt: now,
      reviewNote: args.note,
      updatedAt: now,
    });

    if (emp) {
      await createNotification(ctx, {
        userId: emp.userId,
        type: "correction_rejected",
        title: "Correction Rejected",
        message: `Your correction request (${ticket.ticketId}) has been rejected. Reason: ${args.note}`,
        entityId: args.ticketId,
        entityType: "correctionTicket",
      });
    }

    await logAudit(ctx, {
      userId,
      userRole: user.role ?? "unknown",
      action: "ticket_rejected",
      entity: "correctionTicket",
      entityId: args.ticketId,
      newValue: JSON.stringify({ note: args.note }),
    });

    return true;
  },
});

export const countPending = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("correctionTickets")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.length;
  },
});
