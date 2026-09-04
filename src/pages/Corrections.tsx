import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, getStatusBg, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
} from "lucide-react";

export default function Corrections() {
  const { user } = useAuth();
  const isAdmin = user?.role && user?.role !== "employee";
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");

  const tickets = useQuery(api.corrections.list, {
    status: statusFilter || undefined,
    page,
    pageSize: 15,
  });

  const approveMutation = useMutation(api.corrections.approve);
  const rejectMutation = useMutation(api.corrections.reject);

  const handleApprove = async (id: string) => {
    try {
      await approveMutation({ ticketId: id as any, note: note || undefined });
      toast.success("Correction approved");
      setNote("");
    } catch (error: any) {
      toast.error(error.message || "Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    if (!note) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      await rejectMutation({ ticketId: id as any, note });
      toast.success("Correction rejected");
      setNote("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reject");
    }
  };

  const totalPages = tickets ? Math.ceil(tickets.total / tickets.pageSize) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Correction Tickets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tickets?.total ?? 0} tickets
          </p>
        </div>
        {!isAdmin && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="gap-2 self-start bg-terminal-green hover:bg-terminal-green/90 text-white"
          >
            <Plus className="w-3.5 h-3.5" /> Submit Request
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="terminal-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {["", "pending", "approved", "rejected", "cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(0); }}
                className={cn(
                  "px-3 py-1 rounded text-xs border transition-colors",
                  statusFilter === status
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {status ? status.charAt(0).toUpperCase() + status.slice(1) : "All"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card className="terminal-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Ticket ID</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Reason</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Submitted</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  {isAdmin && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {tickets?.data?.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-muted-foreground">
                      No tickets found
                    </td>
                  </tr>
                )}
                {tickets?.data?.map((ticket) => (
                  <tr key={ticket._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 font-mono font-medium">{ticket.ticketId}</td>
                    <td className="px-4 py-2">
                      <p className="font-medium">{ticket.employeeName}</p>
                      <p className="text-[10px] text-muted-foreground">{ticket.employeeIdCode}</p>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {ticket.correctionType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">
                      {ticket.reason}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDateTime(ticket.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={cn("text-[9px]", getStatusBg(ticket.status))}>
                        {ticket.status?.toUpperCase()}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        {ticket.status === "pending" ? (
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => handleApprove(ticket._id)}
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px] border-terminal-green text-terminal-green hover:bg-terminal-green/10"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button
                              onClick={() => handleReject(ticket._id)}
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px] border-terminal-red text-terminal-red hover:bg-terminal-red/10"
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : ticket.reviewerName ? (
                          <span className="text-[10px] text-muted-foreground">
                            by {ticket.reviewerName}
                          </span>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="h-7 px-2">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="h-7 px-2">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
