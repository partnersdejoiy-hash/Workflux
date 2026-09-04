// ═══════════════════════════════════════════════════════════════════
// WORKFLUX 2.0 — GRANULAR PERMISSIONS SYSTEM
// ═══════════════════════════════════════════════════════════════════

export const PERMISSIONS = {
  // Timesheet
  TIMESHEET_VIEW: "timesheet.view",
  TIMESHEET_VIEW_ALL: "timesheet.view_all",
  TIMESHEET_EDIT: "timesheet.edit",
  TIMESHEET_EDIT_CLOCK_IN: "timesheet.edit_clock_in",
  TIMESHEET_EDIT_CLOCK_OUT: "timesheet.edit_clock_out",
  TIMESHEET_EDIT_BREAK: "timesheet.edit_break",
  TIMESHEET_EDIT_ACTIVITY: "timesheet.edit_activity",
  TIMESHEET_APPROVE: "timesheet.approve",
  TIMESHEET_LOCK: "timesheet.lock",
  TIMESHEET_EXPORT: "timesheet.export",
  TIMESHEET_BULK_EDIT: "timesheet.bulk_edit",

  // Payroll
  PAYROLL_VIEW: "payroll.view",
  PAYROLL_EDIT: "payroll.edit",
  PAYROLL_APPROVE: "payroll.approve",
  PAYROLL_LOCK: "payroll.lock",

  // Audit
  AUDIT_VIEW: "audit.view",

  // Employee
  EMPLOYEE_MANAGE: "employee.manage",

  // Shift
  SHIFT_MANAGE: "shift.manage",

  // Correction
  CORRECTION_APPROVE: "correction.approve",

  // Settings
  SETTINGS_MANAGE: "settings.manage",

  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_EXPORT: "reports.export",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Default role → permissions mapping ───────────────────────────

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: Object.values(PERMISSIONS),

  hr_admin: [
    PERMISSIONS.TIMESHEET_VIEW,
    PERMISSIONS.TIMESHEET_VIEW_ALL,
    PERMISSIONS.TIMESHEET_EDIT,
    PERMISSIONS.TIMESHEET_EDIT_CLOCK_IN,
    PERMISSIONS.TIMESHEET_EDIT_CLOCK_OUT,
    PERMISSIONS.TIMESHEET_EDIT_BREAK,
    PERMISSIONS.TIMESHEET_EDIT_ACTIVITY,
    PERMISSIONS.TIMESHEET_APPROVE,
    PERMISSIONS.TIMESHEET_LOCK,
    PERMISSIONS.TIMESHEET_EXPORT,
    PERMISSIONS.TIMESHEET_BULK_EDIT,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.EMPLOYEE_MANAGE,
    PERMISSIONS.SHIFT_MANAGE,
    PERMISSIONS.CORRECTION_APPROVE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
  ],

  manager: [
    PERMISSIONS.TIMESHEET_VIEW,
    PERMISSIONS.TIMESHEET_VIEW_ALL,
    PERMISSIONS.TIMESHEET_EDIT,
    PERMISSIONS.TIMESHEET_EDIT_CLOCK_IN,
    PERMISSIONS.TIMESHEET_EDIT_CLOCK_OUT,
    PERMISSIONS.TIMESHEET_APPROVE,
    PERMISSIONS.TIMESHEET_EXPORT,
    PERMISSIONS.CORRECTION_APPROVE,
    PERMISSIONS.REPORTS_VIEW,
  ],

  payroll_admin: [
    PERMISSIONS.TIMESHEET_VIEW,
    PERMISSIONS.TIMESHEET_VIEW_ALL,
    PERMISSIONS.TIMESHEET_EXPORT,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_EDIT,
    PERMISSIONS.PAYROLL_APPROVE,
    PERMISSIONS.PAYROLL_LOCK,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
  ],

  employee: [
    PERMISSIONS.TIMESHEET_VIEW,
    PERMISSIONS.TIMESHEET_EXPORT,
  ],
};

// ─── Helper ──────────────────────────────────────────────────────

export function getDefaultPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.employee;
}
