import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getStatusBg, formatDuration } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { DollarSign, Calculator, Lock, Unlock, CheckCircle, Plus } from "lucide-react";

export default function PayrollPage() {
  const { user } = useAuth();
  const isAdmin = user?.role && user?.role !== "employee";

  const periods = useQuery(api.payroll.listPeriods);
  const myPayroll = useQuery(api.payroll.getMyPayroll);
  const calculateMutation = useMutation(api.payroll.calculate);
  const approveMutation = useMutation(api.payroll.approve);
  const lockMutation = useMutation(api.payroll.lock);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const periodRecords = useQuery(
    api.payroll.getPeriodRecords,
    selectedPeriod ? { periodId: selectedPeriod as any } : "skip"
  );

  const handleCalculate = async (periodId: string) => {
    try {
      const result = await calculateMutation({ periodId: periodId as any });
      toast.success(`Payroll calculated: ${result.totalEmployees} employees, $${result.totalGross.toLocaleString()} gross`);
    } catch (error: any) {
      toast.error(error.message || "Failed to calculate");
    }
  };

  const handleApprove = async (periodId: string) => {
    try {
      await approveMutation({ periodId: periodId as any });
      toast.success("Payroll approved");
    } catch (error: any) {
      toast.error(error.message || "Failed to approve");
    }
  };

  const handleLock = async (periodId: string) => {
    try {
      await lockMutation({ periodId: periodId as any });
      toast.success("Payroll locked — records are now immutable");
    } catch (error: any) {
      toast.error(error.message || "Failed to lock");
    }
  };

  if (!isAdmin) {
    // Employee payroll view
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">My Payroll</h1>
        <Card className="terminal-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Period</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Regular Hours</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Overtime</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Gross Pay</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Net Pay</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myPayroll?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">No payroll records yet</td>
                    </tr>
                  )}
                  {myPayroll?.map((record) => (
                    <tr key={record._id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{record.period?.name}</td>
                      <td className="px-4 py-2">{record.regularHours}h</td>
                      <td className="px-4 py-2 text-terminal-amber">{record.overtimeHours}h</td>
                      <td className="px-4 py-2 font-medium">${record.grossPay.toLocaleString()}</td>
                      <td className="px-4 py-2 font-medium text-terminal-green">${record.netPay.toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={cn("text-[9px]", getStatusBg(record.period?.status ?? ""))}>
                          {record.period?.status?.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Payroll Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{periods?.length ?? 0} periods</p>
        </div>
        <Button className="gap-2 self-start bg-terminal-green hover:bg-terminal-green/90 text-white">
          <Plus className="w-3.5 h-3.5" /> Create Period
        </Button>
      </div>

      {/* Periods */}
      <Card className="terminal-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Period</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employees</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Regular Hours</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Overtime</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Gross Pay</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {periods?.map((period) => (
                  <tr key={period._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 font-medium">
                      <button
                        onClick={() => setSelectedPeriod(period._id)}
                        className="hover:text-terminal-green transition-colors"
                      >
                        {period.name}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={cn("text-[9px]", getStatusBg(period.status))}>
                        {period.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{period.totalEmployees ?? "—"}</td>
                    <td className="px-4 py-2">{period.totalRegularHours ? `${period.totalRegularHours}h` : "—"}</td>
                    <td className="px-4 py-2 text-terminal-amber">{period.totalOvertimeHours ? `${period.totalOvertimeHours}h` : "—"}</td>
                    <td className="px-4 py-2 font-medium">{period.totalGrossPay ? `$${period.totalGrossPay.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        {period.status === "open" && (
                          <Button onClick={() => handleCalculate(period._id)} variant="outline" size="sm" className="h-6 px-2 text-[10px]">
                            <Calculator className="w-3 h-3 mr-1" /> Calculate
                          </Button>
                        )}
                        {period.status === "review" && (
                          <>
                            <Button onClick={() => handleApprove(period._id)} variant="outline" size="sm" className="h-6 px-2 text-[10px] border-terminal-green text-terminal-green">
                              <CheckCircle className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button onClick={() => handleCalculate(period._id)} variant="outline" size="sm" className="h-6 px-2 text-[10px]">
                              <Calculator className="w-3 h-3 mr-1" /> Recalc
                            </Button>
                          </>
                        )}
                        {period.status === "approved" && (
                          <Button onClick={() => handleLock(period._id)} variant="outline" size="sm" className="h-6 px-2 text-[10px] border-terminal-red text-terminal-red">
                            <Lock className="w-3 h-3 mr-1" /> Lock
                          </Button>
                        )}
                        {period.status === "locked" && (
                          <Badge variant="outline" className="text-[9px] bg-terminal-blue/10 text-terminal-blue border-terminal-blue/20">
                            <Lock className="w-2.5 h-2.5 mr-1" /> Locked
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Period Details */}
      {selectedPeriod && periodRecords && (
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Period Records</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPeriod(null)} className="text-xs">
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employee</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Dept</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Regular Hours</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Overtime</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Regular Pay</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">OT Pay</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {periodRecords?.map((r) => (
                    <tr key={r._id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{r.employeeName}</td>
                      <td className="px-4 py-2 text-muted-foreground font-mono">{r.employeeIdCode}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.departmentName}</td>
                      <td className="px-4 py-2">{r.regularHours}h</td>
                      <td className="px-4 py-2 text-terminal-amber">{r.overtimeHours}h</td>
                      <td className="px-4 py-2">${r.regularPay.toLocaleString()}</td>
                      <td className="px-4 py-2 text-terminal-amber">${r.overtimePay.toLocaleString()}</td>
                      <td className="px-4 py-2 font-medium text-terminal-green">${r.netPay.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
