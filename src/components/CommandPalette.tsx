import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Clock,
  Square,
  Coffee,
  Play,
  CalendarPlus,
  FilePenLine,
  Inbox,
  FileText,
  Shield,
  Zap,
  Users,
  ClipboardList,
  Activity,
} from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CommandPalette({ open: openProp, onOpenChange }: CommandPaletteProps) {
  const [selfOpen, setSelfOpen] = useState(false);
  const open = openProp !== undefined ? openProp : selfOpen;
  const setOpen = onOpenChange ?? setSelfOpen;
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployee = !user?.role || user.role === "employee";

  const today = useQuery(api.attendance.getToday);
  const startShift = useMutation(api.attendance.startShift);
  const endShift = useMutation(api.attendance.endShift);
  const startBreak = useMutation(api.attendance.startBreak);
  const endBreak = useMutation(api.attendance.endBreak);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOpen, open]);

  const close = () => setOpen(false);
  const go = (path: string) => {
    navigate(path);
    close();
  };

  const action = useCallback(async (key: string, label: string, fn: () => Promise<any>) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r?.isLate) toast.warning("Shift started", { description: `Recorded as late by ${r.lateMinutes} min` });
      else if (r?.netMinutes !== undefined) toast.success(label, { description: `Worked ${r.netMinutes} min` });
      else toast.success(label);
      close();
    } catch (e: any) {
      toast.error(e?.message || `Failed: ${label}`);
    } finally {
      setBusy(null);
    }
  }, []);

  const started = !!today?.clockIn && today?.status !== "shift_completed";
  const onBreak = today?.status === "on_break";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No command found.</CommandEmpty>

        {isEmployee && (
          <CommandGroup heading="Actions">
            {!started && (
              <CommandItem disabled={busy !== null} onSelect={() => action("start", "Shift started", () => startShift())}>
                <Play className="w-4 h-4 text-terminal-green" /> Start Shift
              </CommandItem>
            )}
            {started && (
              <CommandItem disabled={busy !== null} onSelect={() => action("end", "Shift completed", () => endShift())}>
                <Square className="w-4 h-4 text-terminal-red" /> End Shift
              </CommandItem>
            )}
            {started && !onBreak && (
              <CommandItem disabled={busy !== null} onSelect={() => action("brk", "Break started", () => startBreak())}>
                <Coffee className="w-4 h-4 text-terminal-amber" /> Start Break
              </CommandItem>
            )}
            {onBreak && (
              <CommandItem disabled={busy !== null} onSelect={() => action("endbrk", "Break ended", () => endBreak())}>
                <Coffee className="w-4 h-4 text-terminal-amber" /> End Break
              </CommandItem>
            )}
            <CommandItem onSelect={() => go("/app/requests?action=request-leave")}>
              <CalendarPlus className="w-4 h-4 text-terminal-green" /> Request Leave
            </CommandItem>
            <CommandItem onSelect={() => go("/app/editor")}>
              <FilePenLine className="w-4 h-4 text-terminal-blue" /> Open Workflux Editor
            </CommandItem>
          </CommandGroup>
        )}

        {!isEmployee && (
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => go("/app/requests")}>
              <Inbox className="w-4 h-4 text-terminal-amber" /> Review Requests
            </CommandItem>
            <CommandItem onSelect={() => go("/app/live")}>
              <Zap className="w-4 h-4 text-terminal-green" /> Live Attendance
            </CommandItem>
            <CommandItem onSelect={() => go("/app/editor")}>
              <FilePenLine className="w-4 h-4 text-terminal-blue" /> Open Workflux Editor
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/app")}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </CommandItem>
          {isEmployee && (
            <CommandItem onSelect={() => go("/app/my-shift")}>
              <Clock className="w-4 h-4" /> My Shift
            </CommandItem>
          )}
          <CommandItem onSelect={() => go("/app/requests")}>
            <Inbox className="w-4 h-4" /> Request Center
          </CommandItem>
          {!isEmployee && (
            <>
              <CommandItem onSelect={() => go("/app/timesheets")}>
                <FileText className="w-4 h-4" /> Timesheets
              </CommandItem>
              <CommandItem onSelect={() => go("/app/employees")}>
                <Users className="w-4 h-4" /> Employees
              </CommandItem>
              <CommandItem onSelect={() => go("/app/audit")}>
                <Shield className="w-4 h-4" /> Audit Logs
              </CommandItem>
            </>
          )}
          <CommandItem onSelect={() => go("/app/corrections")}>
            <ClipboardList className="w-4 h-4" /> Corrections
          </CommandItem>
          <CommandItem onSelect={() => go("/app/editor")}>
            <Activity className="w-4 h-4" /> Workflux Editor
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
