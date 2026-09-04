import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Time & Formatting ─────────────────────────────────────────────

export function msToHMS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${time}`;
}

// ─── Status Helpers ────────────────────────────────────────────────

export function getStatusBg(status: string): string {
  switch (status) {
    case "working":
    case "active":
    case "approved":
    case "paid":
    case "calculated":
      return "bg-terminal-green/10 text-terminal-green border-terminal-green/20";
    case "on_break":
    case "late":
    case "overtime":
    case "review":
    case "pending":
      return "bg-terminal-amber/10 text-terminal-amber border-terminal-amber/20";
    case "shift_completed":
    case "completed":
    case "locked":
    case "open":
      return "bg-terminal-blue/10 text-terminal-blue border-terminal-blue/20";
    case "absent":
    case "inactive":
    case "rejected":
    case "terminated":
    case "void":
      return "bg-terminal-red/10 text-terminal-red border-terminal-red/20";
    case "not_started":
    case "suspended":
    case "cancelled":
    case "archived":
      return "bg-muted text-muted-foreground border-border";
    case "early_leave":
      return "bg-terminal-amber/10 text-terminal-amber border-terminal-amber/20";
    case "leave":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "holiday":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
