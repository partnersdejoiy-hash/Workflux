import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { ROLES, type Role } from "./schema";

// ─── Authentication Helpers ─────────────────────────────────────────

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Authentication required");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  return { userId, user };
}

export async function getCurrentEmployee(ctx: QueryCtx | MutationCtx) {
  const { userId, user } = await requireAuth(ctx);
  const employee = await ctx.db
    .query("employees")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return { userId, user, employee };
}

// ─── Role-Based Access Control ──────────────────────────────────────

const ADMIN_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN, ROLES.MANAGER, ROLES.PAYROLL_ADMIN];

export function hasAdminAccess(role?: Role): boolean {
  return role !== undefined && ADMIN_ROLES.includes(role as string);
}

const PAYROLL_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN, ROLES.PAYROLL_ADMIN];
const EMP_MGMT_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.HR_ADMIN, ROLES.MANAGER];

export function hasPayrollAccess(role?: Role): boolean {
  return role !== undefined && PAYROLL_ROLES.includes(role as string);
}

export function hasEmployeeManagementAccess(role?: Role): boolean {
  return role !== undefined && EMP_MGMT_ROLES.includes(role as string);
}

export function canApproveCorrections(role?: Role): boolean {
  return role !== undefined && EMP_MGMT_ROLES.includes(role as string);
}

// ─── Time & Date Helpers ────────────────────────────────────────────

export function dateToYMD(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function ymdToDate(ymd: number): Date {
  const year = Math.floor(ymd / 10000);
  const month = Math.floor((ymd % 10000) / 100) - 1;
  const day = ymd % 100;
  return new Date(year, month, day);
}

export function getTodayYMD(): number {
  return dateToYMD(new Date());
}

export function minutesToHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

export function minutesToHMS(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function msToHMS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isOvernightShift(startMinutes: number, endMinutes: number): boolean {
  return endMinutes <= startMinutes;
}

// ─── Audit Logger ───────────────────────────────────────────────────

export async function logAudit(
  ctx: MutationCtx,
  params: {
    userId: any;
    userRole: string;
    action: string;
    entity: string;
    entityId?: string;
    previousValue?: string;
    newValue?: string;
    ipAddress?: string;
    deviceInfo?: string;
  }
) {
  await ctx.db.insert("auditLogs", {
    userId: params.userId,
    userRole: params.userRole,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    previousValue: params.previousValue,
    newValue: params.newValue,
    ipAddress: params.ipAddress,
    deviceInfo: params.deviceInfo,
    timestamp: Date.now(),
  });
}

// ─── Notification Helper ────────────────────────────────────────────

export async function createNotification(
  ctx: MutationCtx,
  params: {
    userId: any;
    type: any;
    title: string;
    message: string;
    entityId?: string;
    entityType?: string;
  }
) {
  await ctx.db.insert("notifications", {
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    isRead: false,
    entityId: params.entityId,
    entityType: params.entityType,
    createdAt: Date.now(),
  });
}

// ─── Ticket ID Generator ────────────────────────────────────────────

export function generateTicketId(): string {
  const now = new Date();
  const prefix = "TC";
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

// ─── Employee ID Generator ──────────────────────────────────────────

export function generateEmployeeId(index: number): string {
  return `EMP${String(index).padStart(4, "0")}`;
}

// ─── Rounding Rules ─────────────────────────────────────────────────

export function roundToNearest(value: number, nearest: number): number {
  return Math.round(value / nearest) * nearest;
}

export function calculateOvertime(
  netMinutes: number,
  thresholdMinutes: number,
  multiplier: number
): { regularMinutes: number; overtimeMinutes: number; overtimePay: number } {
  const regularMinutes = Math.min(netMinutes, thresholdMinutes);
  const overtimeMinutes = Math.max(0, netMinutes - thresholdMinutes);
  const overtimePay = (overtimeMinutes / 60) * multiplier;
  return { regularMinutes, overtimeMinutes, overtimePay };
}

// ─── Re--export central calculation engine ────────────────────────────────────────────
export { calculateAttendance } from "./calc";
export { calculateTotalBreaks } from "./calc";
export { calculateActivityTotals } from "./calc";
export { calculateScheduledMinutes } from "./calc";
export { formatMinutes } from "./calc";
export { formatTimer } from "./calc";
export { minutesBetween } from "./calc";
export { applyRounding } from "./calc";
export { getShiftStartMs } from "./calc";
export { getShiftEndMs } from "./calc";
