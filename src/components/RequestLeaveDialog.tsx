import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ymdOf, ymdFromInput } from "@/lib/utils";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: "Sick Leave",
  vacation: "Vacation",
  personal: "Personal",
  unpaid: "Unpaid",
  other: "Other",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: string;
}

export default function RequestLeaveDialog({ open, onOpenChange, defaultType }: Props) {
  const requestLeave = useMutation(api.leaves.request);
  const [type, setType] = useState(defaultType ?? "sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setType(defaultType ?? "sick");
    setStartDate("");
    setEndDate("");
    setReason("");
    setError(null);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Start and end dates are required");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const start = ymdFromInput(startDate);
      const end = ymdFromInput(endDate);
      const today = ymdOf(new Date());
      if (end < start) {
        setError("End date must be on or after the start date");
        setLoading(false);
        return;
      }
      if (end < today) {
        setError("Leave cannot be requested for past dates");
        setLoading(false);
        return;
      }
      await requestLeave({ type, startDate: start, endDate: end, reason });
      toast.success("Leave request submitted", {
        description: `${LEAVE_TYPE_LABELS[type] ?? type} · pending approval`,
      });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || "Failed to submit leave request");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>
            Submit a leave request. It will be routed to your manager for approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="leave-type">Leave Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="leave-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leave-start">Start Date</Label>
              <Input id="leave-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-end">End Date</Label>
              <Input id="leave-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leave-reason">Reason</Label>
            <Textarea
              id="leave-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you requesting leave?"
              rows={3}
            />
          </div>
          {error && <p className="text-xs text-terminal-red">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Request Leave"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
