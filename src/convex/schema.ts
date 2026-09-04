import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ─── Role-Based Access Control ──────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  HR_ADMIN: "hr_admin",
  MANAGER: "manager",
  PAYROLL_ADMIN: "payroll_admin",
  EMPLOYEE: "employee",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.SUPER_ADMIN),
  v.literal(ROLES.HR_ADMIN),
  v.literal(ROLES.MANAGER),
  v.literal(ROLES.PAYROLL_ADMIN),
  v.literal(ROLES.EMPLOYEE),
);
export type Role = Infer<typeof roleValidator>;

// ─── Attendance Statuses ────────────────────────────────────────────
export const ATTENDANCE_STATUS = {
  NOT_STARTED: "not_started",
  WORKING: "working",
  ON_BREAK: "on_break",
  SHIFT_COMPLETED: "shift_completed",
  ABSENT: "absent",
  LATE: "late",
  EARLY_LEAVE: "early_leave",
  OVERTIME: "overtime",
  HOLIDAY: "holiday",
  LEAVE: "leave",
} as const;

export const attendanceStatusValidator = v.union(
  v.literal(ATTENDANCE_STATUS.NOT_STARTED),
  v.literal(ATTENDANCE_STATUS.WORKING),
  v.literal(ATTENDANCE_STATUS.ON_BREAK),
  v.literal(ATTENDANCE_STATUS.SHIFT_COMPLETED),
  v.literal(ATTENDANCE_STATUS.ABSENT),
  v.literal(ATTENDANCE_STATUS.LATE),
  v.literal(ATTENDANCE_STATUS.EARLY_LEAVE),
  v.literal(ATTENDANCE_STATUS.OVERTIME),
  v.literal(ATTENDANCE_STATUS.HOLIDAY),
  v.literal(ATTENDANCE_STATUS.LEAVE),
);

// ─── Employee Statuses ──────────────────────────────────────────────
export const EMPLOYEE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  TERMINATED: "terminated",
  ARCHIVED: "archived",
} as const;

export const employeeStatusValidator = v.union(
  v.literal(EMPLOYEE_STATUS.ACTIVE),
  v.literal(EMPLOYEE_STATUS.INACTIVE),
  v.literal(EMPLOYEE_STATUS.SUSPENDED),
  v.literal(EMPLOYEE_STATUS.TERMINATED),
  v.literal(EMPLOYEE_STATUS.ARCHIVED),
);

// ─── Pay Types ──────────────────────────────────────────────────────
export const PAY_TYPES = {
  HOURLY: "hourly",
  SALARY: "salary",
} as const;

export const payTypeValidator = v.union(
  v.literal(PAY_TYPES.HOURLY),
  v.literal(PAY_TYPES.SALARY),
);

// ─── Payroll Period Status ──────────────────────────────────────────
export const PAYROLL_STATUS = {
  OPEN: "open",
  CALCULATING: "calculating",
  REVIEW: "review",
  APPROVED: "approved",
  LOCKED: "locked",
  PAID: "paid",
  VOID: "void",
} as const;

export const payrollStatusValidator = v.union(
  v.literal(PAYROLL_STATUS.OPEN),
  v.literal(PAYROLL_STATUS.CALCULATING),
  v.literal(PAYROLL_STATUS.REVIEW),
  v.literal(PAYROLL_STATUS.APPROVED),
  v.literal(PAYROLL_STATUS.LOCKED),
  v.literal(PAYROLL_STATUS.PAID),
  v.literal(PAYROLL_STATUS.VOID),
);

// ─── Correction Ticket Status ───────────────────────────────────────
export const TICKET_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export const ticketStatusValidator = v.union(
  v.literal(TICKET_STATUS.PENDING),
  v.literal(TICKET_STATUS.APPROVED),
  v.literal(TICKET_STATUS.REJECTED),
  v.literal(TICKET_STATUS.CANCELLED),
);

// ─── Correction Types ───────────────────────────────────────────────
export const CORRECTION_TYPES = {
  MISSING_CLOCK_IN: "missing_clock_in",
  MISSING_CLOCK_OUT: "missing_clock_out",
  WRONG_CLOCK_IN: "wrong_clock_in",
  WRONG_CLOCK_OUT: "wrong_clock_out",
  INCORRECT_BREAK: "incorrect_break",
  INCORRECT_ACTIVITY: "incorrect_activity",
  OTHER: "other",
} as const;

export const correctionTypeValidator = v.union(
  v.literal(CORRECTION_TYPES.MISSING_CLOCK_IN),
  v.literal(CORRECTION_TYPES.MISSING_CLOCK_OUT),
  v.literal(CORRECTION_TYPES.WRONG_CLOCK_IN),
  v.literal(CORRECTION_TYPES.WRONG_CLOCK_OUT),
  v.literal(CORRECTION_TYPES.INCORRECT_BREAK),
  v.literal(CORRECTION_TYPES.INCORRECT_ACTIVITY),
  v.literal(CORRECTION_TYPES.OTHER),
);

// ─── Notification Types ─────────────────────────────────────────────
export const NOTIFICATION_TYPES = {
  SHIFT_STARTING: "shift_starting",
  CORRECTION_APPROVED: "correction_approved",
  CORRECTION_REJECTED: "correction_rejected",
  SHIFT_ASSIGNED: "shift_assigned",
  PAYROLL_FINALIZED: "payroll_finalized",
  CORRECTION_SUBMITTED: "correction_submitted",
  MISSING_CLOCK_OUT: "missing_clock_out",
  UNUSUAL_ATTENDANCE: "unusual_attendance",
  PAYROLL_REQUIRES_APPROVAL: "payroll_requires_approval",
  LEAVE_REQUESTED: "leave_requested",
  LEAVE_APPROVED: "leave_approved",
  LEAVE_REJECTED: "leave_rejected",
  LEAVE_CANCELLED: "leave_cancelled",
  ADJUSTMENT_SUBMITTED: "adjustment_submitted",
  ADJUSTMENT_APPROVED: "adjustment_approved",
  ADJUSTMENT_REJECTED: "adjustment_rejected",
} as const;

export const notificationTypeValidator = v.union(
  v.literal(NOTIFICATION_TYPES.SHIFT_STARTING),
  v.literal(NOTIFICATION_TYPES.CORRECTION_APPROVED),
  v.literal(NOTIFICATION_TYPES.CORRECTION_REJECTED),
  v.literal(NOTIFICATION_TYPES.SHIFT_ASSIGNED),
  v.literal(NOTIFICATION_TYPES.PAYROLL_FINALIZED),
  v.literal(NOTIFICATION_TYPES.CORRECTION_SUBMITTED),
  v.literal(NOTIFICATION_TYPES.MISSING_CLOCK_OUT),
  v.literal(NOTIFICATION_TYPES.UNUSUAL_ATTENDANCE),
  v.literal(NOTIFICATION_TYPES.PAYROLL_REQUIRES_APPROVAL),
  v.literal(NOTIFICATION_TYPES.LEAVE_REQUESTED),
  v.literal(NOTIFICATION_TYPES.LEAVE_APPROVED),
  v.literal(NOTIFICATION_TYPES.LEAVE_REJECTED),
  v.literal(NOTIFICATION_TYPES.LEAVE_CANCELLED),
  v.literal(NOTIFICATION_TYPES.ADJUSTMENT_SUBMITTED),
  v.literal(NOTIFICATION_TYPES.ADJUSTMENT_APPROVED),
  v.literal(NOTIFICATION_TYPES.ADJUSTMENT_REJECTED),
);

// ═══════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════

const schema = defineSchema(
  {
    // Auth tables - DO NOT REMOVE
    ...authTables,

    // ─── Users (extends auth) ────────────────────────────────────
    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    // ─── Departments ─────────────────────────────────────────────
    departments: defineTable({
      name: v.string(),
      code: v.string(),
      description: v.optional(v.string()),
      managerId: v.optional(v.id("employees")),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_code", ["code"])
      .index("by_active", ["isActive"]),

    // ─── Teams ───────────────────────────────────────────────────
    teams: defineTable({
      name: v.string(),
      code: v.string(),
      departmentId: v.id("departments"),
      leadId: v.optional(v.id("employees")),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_department", ["departmentId"])
      .index("by_code", ["code"]),

    // ─── Designations / Roles ────────────────────────────────────
    designations: defineTable({
      name: v.string(),
      code: v.string(),
      level: v.optional(v.number()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_code", ["code"]),

    // ─── Employees ──────────────────────────────────────────────
    employees: defineTable({
      userId: v.id("users"),
      employeeId: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      departmentId: v.id("departments"),
      teamId: v.optional(v.id("teams")),
      designationId: v.optional(v.id("designations")),
      managerId: v.optional(v.id("employees")),
      joiningDate: v.number(),
      employmentStatus: employeeStatusValidator,
      payType: payTypeValidator,
      hourlyRate: v.optional(v.number()),
      monthlySalary: v.optional(v.number()),
      overtimeMultiplier: v.number(),
      holidayMultiplier: v.number(),
      timezone: v.string(),
      profilePhoto: v.optional(v.string()),
      emergencyContact: v.optional(v.string()),
      emergencyPhone: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"])
      .index("by_employee_id", ["employeeId"])
      .index("by_department", ["departmentId"])
      .index("by_team", ["teamId"])
      .index("by_manager", ["managerId"])
      .index("by_status", ["employmentStatus"]),

    // ─── Shifts ─────────────────────────────────────────────────
    shifts: defineTable({
      name: v.string(),
      code: v.string(),
      startTime: v.string(), // "HH:MM" format
      endTime: v.string(), // "HH:MM" format
      isOvernight: v.boolean(),
      gracePeriodMinutes: v.number(),
      minimumWorkingHours: v.number(),
      overtimeThresholdHours: v.number(),
      workingDays: v.array(v.number()), // 0=Sun, 1=Mon, ... 6=Sat
      breakMinutes: v.number(),
      departmentId: v.optional(v.id("departments")),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_code", ["code"])
      .index("by_department", ["departmentId"]),

    // ─── Shift Assignments ──────────────────────────────────────
    shiftAssignments: defineTable({
      employeeId: v.id("employees"),
      shiftId: v.id("shifts"),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_employee", ["employeeId"])
      .index("by_shift", ["shiftId"])
      .index("by_active", ["isActive"])
      .index("by_employee_date", ["employeeId", "startDate"]),

    // ─── Attendance Sessions ────────────────────────────────────
    attendanceSessions: defineTable({
      employeeId: v.id("employees"),
      shiftId: v.optional(v.id("shifts")),
      date: v.number(), // date as YYYYMMDD number for efficient queries
      clockIn: v.number(), // timestamp
      clockOut: v.optional(v.number()),
      scheduledStart: v.optional(v.string()),
      scheduledEnd: v.optional(v.string()),
      status: attendanceStatusValidator,
      grossMinutes: v.optional(v.number()),
      breakMinutes: v.optional(v.number()),
      netMinutes: v.optional(v.number()),
      overtimeMinutes: v.optional(v.number()),
      isLate: v.boolean(),
      lateMinutes: v.optional(v.number()),
      isEarlyLeave: v.boolean(),
      earlyLeaveMinutes: v.optional(v.number()),
      deviceInfo: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_employee", ["employeeId"])
      .index("by_date", ["date"])
      .index("by_employee_date", ["employeeId", "date"])
      .index("by_status", ["status"])
      .index("by_shift", ["shiftId"]),

    // ─── Break Sessions ─────────────────────────────────────────
    breakSessions: defineTable({
      attendanceSessionId: v.id("attendanceSessions"),
      employeeId: v.id("employees"),
      breakStart: v.number(),
      breakEnd: v.optional(v.number()),
      durationMinutes: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_session", ["attendanceSessionId"])
      .index("by_employee", ["employeeId"]),

    // ─── Activity Types ─────────────────────────────────────────
    activityTypes: defineTable({
      name: v.string(),
      code: v.string(),
      color: v.optional(v.string()),
      isActive: v.boolean(),
      createdBy: v.optional(v.id("users")),
      createdAt: v.number(),
    }).index("by_code", ["code"]),

    // ─── Activity Sessions ──────────────────────────────────────
    activitySessions: defineTable({
      attendanceSessionId: v.id("attendanceSessions"),
      employeeId: v.id("employees"),
      activityTypeId: v.id("activityTypes"),
      startTime: v.number(),
      endTime: v.optional(v.number()),
      durationMinutes: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_session", ["attendanceSessionId"])
      .index("by_employee", ["employeeId"])
      .index("by_activity", ["activityTypeId"]),

    // ─── Correction Tickets ─────────────────────────────────────
    correctionTickets: defineTable({
      ticketId: v.string(),
      employeeId: v.id("employees"),
      attendanceSessionId: v.optional(v.id("attendanceSessions")),
      date: v.number(),
      correctionType: correctionTypeValidator,
      originalValue: v.optional(v.string()),
      requestedValue: v.string(),
      reason: v.string(),
      status: ticketStatusValidator,
      reviewerId: v.optional(v.id("employees")),
      reviewedAt: v.optional(v.number()),
      reviewNote: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_employee", ["employeeId"])
      .index("by_status", ["status"])
      .index("by_attendance", ["attendanceSessionId"])
      .index("by_date", ["date"]),

    // ─── Payroll Periods ────────────────────────────────────────
    payrollPeriods: defineTable({
      name: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      status: payrollStatusValidator,
      totalEmployees: v.optional(v.number()),
      totalRegularHours: v.optional(v.number()),
      totalOvertimeHours: v.optional(v.number()),
      totalGrossPay: v.optional(v.number()),
      totalNetPay: v.optional(v.number()),
      calculatedBy: v.optional(v.id("users")),
      calculatedAt: v.optional(v.number()),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      lockedBy: v.optional(v.id("users")),
      lockedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_status", ["status"])
      .index("by_dates", ["startDate", "endDate"]),

    // ─── Payroll Records ────────────────────────────────────────
    payrollRecords: defineTable({
      payrollPeriodId: v.id("payrollPeriods"),
      employeeId: v.id("employees"),
      regularHours: v.number(),
      overtimeHours: v.number(),
      holidayHours: v.number(),
      paidLeaveHours: v.number(),
      unpaidLeaveHours: v.number(),
      baseRate: v.number(),
      regularPay: v.number(),
      overtimePay: v.number(),
      holidayPay: v.number(),
      grossPay: v.number(),
      allowances: v.number(),
      deductions: v.number(),
      bonuses: v.number(),
      adjustments: v.number(),
      netPay: v.number(),
      status: v.string(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_period", ["payrollPeriodId"])
      .index("by_employee", ["employeeId"])
      .index("by_period_employee", ["payrollPeriodId", "employeeId"]),

    // ─── Payroll Adjustments ────────────────────────────────────
    payrollAdjustments: defineTable({
      payrollRecordId: v.id("payrollRecords"),
      type: v.string(), // "allowance", "deduction", "bonus", "adjustment"
      description: v.string(),
      amount: v.number(),
      createdBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_record", ["payrollRecordId"]),

    // ─── Leave Records ──────────────────────────────────────────
    leaveRecords: defineTable({
      employeeId: v.id("employees"),
      type: v.string(), // "sick", "vacation", "personal", "unpaid", "other"
      startDate: v.number(),
      endDate: v.number(),
      reason: v.optional(v.string()),
      status: v.string(), // "pending", "approved", "rejected", "cancelled"
      approvedBy: v.optional(v.id("users")),
      durationDays: v.optional(v.number()),
      reviewNote: v.optional(v.string()),
      approvedAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_employee", ["employeeId"])
      .index("by_status", ["status"])
      .index("by_employee_status", ["employeeId", "status"]),

    // ─── Holidays ───────────────────────────────────────────────
    holidays: defineTable({
      name: v.string(),
      date: v.number(),
      year: v.number(),
      isRecurring: v.boolean(),
      description: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_date", ["date"])
      .index("by_year", ["year"]),

    // ─── Audit Logs ─────────────────────────────────────────────
    auditLogs: defineTable({
      userId: v.id("users"),
      userRole: v.string(),
      action: v.string(),
      entity: v.string(),
      entityId: v.optional(v.string()),
      previousValue: v.optional(v.string()),
      newValue: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      deviceInfo: v.optional(v.string()),
      timestamp: v.number(),
    }).index("by_user", ["userId"])
      .index("by_action", ["action"])
      .index("by_entity", ["entity"])
      .index("by_timestamp", ["timestamp"]),

    // ─── Notifications ──────────────────────────────────────────
    notifications: defineTable({
      userId: v.id("users"),
      type: notificationTypeValidator,
      title: v.string(),
      message: v.string(),
      isRead: v.boolean(),
      entityId: v.optional(v.string()),
      entityType: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"])
      .index("by_user_read", ["userId", "isRead"]),

    // ─── System Settings ────────────────────────────────────────
    systemSettings: defineTable({
      key: v.string(),
      value: v.string(),
      description: v.optional(v.string()),
      updatedBy: v.optional(v.id("users")),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // ─── Payroll Configuration ──────────────────────────────────
    payrollConfig: defineTable({
      key: v.string(),
      value: v.string(),
      description: v.optional(v.string()),
      updatedBy: v.optional(v.id("users")),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // ═════════════════════════════════════════════════════════════
    // WORKFLUX 2.0 — EVENT-ORIENTED TIMEKEEPING
    // ═════════════════════════════════════════════════════════════

    // ─── Attendance Events (immutable log) ──────────────────────
    attendanceEvents: defineTable({
      employeeId: v.id("employees"),
      attendanceSessionId: v.optional(v.id("attendanceSessions")),
      type: v.string(), // SHIFT_STARTED, SHIFT_ENDED, BREAK_STARTED, BREAK_ENDED, ACTIVITY_STARTED, ACTIVITY_ENDED, CLOCK_ADJUSTED, CORRECTION_REQUESTED, CORRECTION_APPROVED, CORRECTION_REJECTED, MANUAL_ADJUSTMENT
      timestamp: v.number(),
      value: v.optional(v.string()), // JSON of the event data
      metadata: v.optional(v.string()), // JSON metadata (device, IP, etc.)
      createdBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_employee", ["employeeId"])
      .index("by_session", ["attendanceSessionId"])
      .index("by_type", ["type"])
      .index("by_timestamp", ["timestamp"])
      .index("by_employee_date", ["employeeId", "timestamp"]),

    // ─── Time Adjustments (official edits) ──────────────────────
    timeAdjustments: defineTable({
      employeeId: v.id("employees"),
      attendanceSessionId: v.id("attendanceSessions"),
      field: v.string(), // clockIn, clockOut, breakMinutes, etc.
      originalValue: v.string(),
      newValue: v.string(),
      reason: v.string(),
      adjustmentType: v.string(), // "admin_edit", "correction_approved", "payroll_adjustment"
      status: v.string(), // "pending", "approved", "rejected", "applied"
      requestedBy: v.id("users"),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      rejectionReason: v.optional(v.string()),
      payrollImpact: v.optional(v.number()), // estimated payroll impact in cents
      auditId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_employee", ["employeeId"])
      .index("by_session", ["attendanceSessionId"])
      .index("by_status", ["status"])
      .index("by_requestedBy", ["requestedBy"])
      .index("by_createdAt", ["createdAt"]),

    // ─── Exceptions ─────────────────────────────────────────────
    exceptions: defineTable({
      employeeId: v.id("employees"),
      attendanceSessionId: v.optional(v.id("attendanceSessions")),
      date: v.number(),
      type: v.string(), // missing_clock_in, missing_clock_out, long_break, short_hours, late_arrival, early_departure, overtime, no_activity, shift_without_activity, overlapping_activity, etc.
      severity: v.string(), // "critical", "warning", "info"
      description: v.string(),
      expectedValue: v.optional(v.string()),
      actualValue: v.optional(v.string()),
      status: v.string(), // "open", "resolved", "ignored", "correction_requested"
      resolvedBy: v.optional(v.id("users")),
      resolvedAt: v.optional(v.number()),
      resolution: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_employee", ["employeeId"])
      .index("by_date", ["date"])
      .index("by_status", ["status"])
      .index("by_type", ["type"])
      .index("by_severity", ["severity"]),

    // ─── Saved Views ────────────────────────────────────────────
    savedViews: defineTable({
      userId: v.id("users"),
      name: v.string(),
      type: v.string(), // "timesheet", "live", "payroll"
      config: v.string(), // JSON: { columns, filters, sorting, grouping, dateRange }
      isDefault: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"])
      .index("by_user_type", ["userId", "type"]),

    // ─── Timesheet Locks (row-level) ────────────────────────────
    timesheetLocks: defineTable({
      employeeId: v.id("employees"),
      payrollPeriodId: v.optional(v.id("payrollPeriods")),
      startDate: v.number(),
      endDate: v.number(),
      lockedBy: v.id("users"),
      lockedAt: v.number(),
      reason: v.optional(v.string()),
    }).index("by_employee", ["employeeId"])
      .index("by_period", ["payrollPeriodId"]),

    // ─── Role Permissions ───────────────────────────────────────
    rolePermissions: defineTable({
      role: v.string(),
      permissions: v.array(v.string()), // Array of permission strings
      updatedAt: v.number(),
      updatedBy: v.optional(v.id("users")),
    }).index("by_role", ["role"]),

    // ─── Payroll Locks ──────────────────────────────────────────
    payrollLocks: defineTable({
      payrollPeriodId: v.id("payrollPeriods"),
      lockedBy: v.id("users"),
      lockedAt: v.number(),
      adjustmentsAfterLock: v.number(),
    }).index("by_period", ["payrollPeriodId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
