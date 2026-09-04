import { query } from "./_generated/server";
import { getCurrentEmployee, hasEmployeeManagementAccess } from "./helpers";

// Pending-queue counts for the current user's role.
// Employees get zeros; approvers get live pending counts.
export const queueCounts = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await getCurrentEmployee(ctx);
    const base = { leave: 0, corrections: 0, adjustments: 0 };
    if (!user || !hasEmployeeManagementAccess(user.role)) return base;

    const [leave, corrections, adjustments] = await Promise.all([
      ctx.db
        .query("leaveRecords")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("correctionTickets")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("timeAdjustments")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
    ]);

    return {
      leave: leave.length,
      corrections: corrections.length,
      adjustments: adjustments.length,
    };
  },
});
