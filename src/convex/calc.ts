// ═══════════════════════════════════════════════════════════════════
// WORKFLUX 2.0 — CENTRALIZED TIME CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════════
// Every timesheet, dashboard, report, and payroll calculation
// MUST go through this engine. No duplicated formulas elsewhere.

// ─── Types ───────────────────────────────────────────────────────

export interface BreakRecord {
  breakStart: number;
  breakEnd?: number;
  durationMinutes?: number;
}

export interface ActivityRecord {
  startTime: number;
  endTime?: number;
  durationMinutes?: number;
  activityName?: string;
}

export interface ShiftConfig {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  isOvernight: boolean;
  gracePeriodMinutes: number;
  minimumWorkingHours: number;
  overtimeThresholdHours: number;
  breakMinutes: number;
}

export interface CalculationResult {
  grossMinutes: number;
  breakMinutes: number;
  netMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  scheduledMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  isLate: boolean;
  isEarlyLeave: boolean;
  isOvertime: boolean;
}

// ─── Core Calculations ───────────────────────────────────────────

/**
 * Calculate complete attendance metrics from raw timestamps.
 * This is THE source of truth for all time calculations.
 */
export function calculateAttendance(params: {
  clockIn: number;
  clockOut?: number;
  breaks: BreakRecord[];
  shift?: ShiftConfig;
  rounding?: number; // minutes, 0 = no rounding
}): CalculationResult {
  const { clockIn, clockOut, breaks, shift, rounding = 0 } = params;

  if (!clockOut) {
    return {
      grossMinutes: 0,
      breakMinutes: 0,
      netMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      scheduledMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      isLate: false,
      isEarlyLeave: false,
      isOvertime: false,
    };
  }

  // Gross duration
  let grossMinutes = minutesBetween(clockIn, clockOut);
  grossMinutes = applyRounding(grossMinutes, rounding);

  // Total break duration
  const breakMinutes = calculateTotalBreaks(breaks, rounding);

  // Net working time
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);

  // Scheduled duration
  let scheduledMinutes = 0;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let isLate = false;
  let isEarlyLeave = false;

  if (shift) {
    scheduledMinutes = calculateScheduledMinutes(shift);

    // Late detection
    const [startH, startM] = shift.startTime.split(":").map(Number);
    const shiftStartMs = getShiftStartMs(clockIn, startH, startM, shift.isOvernight);
    const graceMs = shift.gracePeriodMinutes * 60 * 1000;
    if (clockIn > shiftStartMs + graceMs) {
      isLate = true;
      lateMinutes = Math.floor((clockIn - shiftStartMs) / 60000);
    }

    // Early leave detection
    const [endH, endM] = shift.endTime.split(":").map(Number);
    const shiftEndMs = getShiftEndMs(clockIn, endH, endM, shift.isOvernight);
    const clockOutMinOfDay = new Date(clockOut).getHours() * 60 + new Date(clockOut).getMinutes();
    const scheduledEndMinOfDay = endH * 60 + endM;
    if (clockOutMinOfDay < scheduledEndMinOfDay && netMinutes < shift.minimumWorkingHours * 60) {
      isEarlyLeave = true;
      earlyLeaveMinutes = scheduledEndMinOfDay - clockOutMinOfDay;
    }
  }

  // Overtime
  const thresholdMinutes = shift ? shift.overtimeThresholdHours * 60 : 480;
  const overtimeMinutes = Math.max(0, netMinutes - thresholdMinutes);
  const isOvertime = overtimeMinutes > 0;

  // Regular = net - overtime
  const regularMinutes = Math.min(netMinutes, thresholdMinutes);

  return {
    grossMinutes,
    breakMinutes,
    netMinutes,
    regularMinutes,
    overtimeMinutes,
    scheduledMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    isLate,
    isEarlyLeave,
    isOvertime,
  };
}

/**
 * Calculate total break duration from break records.
 */
export function calculateTotalBreaks(breaks: BreakRecord[], rounding = 0): number {
  return breaks.reduce((total, b) => {
    const duration = b.durationMinutes ?? (b.breakEnd ? minutesBetween(b.breakStart, b.breakEnd) : 0);
    return total + applyRounding(duration, rounding);
  }, 0);
}

/**
 * Calculate activity totals from activity records.
 */
export function calculateActivityTotals(activities: ActivityRecord[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const a of activities) {
    const name = a.activityName ?? "Unknown";
    const duration = a.durationMinutes ?? (a.endTime ? minutesBetween(a.startTime, a.endTime) : 0);
    totals.set(name, (totals.get(name) ?? 0) + duration);
  }
  return totals;
}

/**
 * Calculate scheduled shift duration in minutes.
 */
export function calculateScheduledMinutes(shift: ShiftConfig): number {
  const [startH, startM] = shift.startTime.split(":").map(Number);
  const [endH, endM] = shift.endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  if (shift.isOvernight) {
    return (24 * 60 - startMin) + endMin;
  }
  return Math.max(0, endMin - startMin);
}

/**
 * Format minutes to "Xh Ym" display.
 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.round(Math.abs(minutes) % 60);
  return `${h}h ${m}m`;
}

/**
 * Format minutes to HH:MM:SS timer display.
 */
export function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Helpers ─────────────────────────────────────────────────────

function minutesBetween(startMs: number, endMs: number): number {
  return Math.round((endMs - startMs) / 60000);
}

function applyRounding(minutes: number, rounding: number): number {
  if (rounding <= 0) return minutes;
  return Math.round(minutes / rounding) * rounding;
}

function getShiftStartMs(referenceMs: number, startH: number, startM: number, isOvernight: boolean): number {
  const d = new Date(referenceMs);
  d.setHours(startH, startM, 0, 0);
  return d.getTime();
}

function getShiftEndMs(referenceMs: number, endH: number, endM: number, isOvernight: boolean): number {
  const d = new Date(referenceMs);
  if (isOvernight) {
    d.setDate(d.getDate() + 1);
  }
  d.setHours(endH, endM, 0, 0);
  return d.getTime();
}
