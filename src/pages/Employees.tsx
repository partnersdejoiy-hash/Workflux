import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, getStatusBg, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Search, UserPlus, Edit2, Eye } from "lucide-react";

export default function Employees() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const employees = useQuery(api.employees.list, {
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const departments = useQuery(api.departments.list);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Employees</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {employees?.length ?? 0} employees
          </p>
        </div>
        <Button className="gap-2 self-start bg-terminal-green hover:bg-terminal-green/90 text-white">
          <UserPlus className="w-3.5 h-3.5" />
          Add Employee
        </Button>
      </div>

      {/* Filters */}
      <Card className="terminal-card">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 text-xs border border-border rounded px-2 bg-background"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card className="terminal-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Department</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Team</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Pay Type</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Rate</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Joined</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees?.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      No employees found
                    </td>
                  </tr>
                )}
                {employees?.map((emp) => (
                  <tr key={emp._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-terminal-green/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-medium text-terminal-green">
                            {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-muted-foreground">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground font-mono">{emp.employeeId}</td>
                    <td className="px-4 py-2 text-muted-foreground">{emp.departmentName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{emp.teamName ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-[9px]">
                        {emp.payType?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {emp.payType === "hourly"
                        ? `$${emp.hourlyRate}/hr`
                        : emp.monthlySalary
                        ? `$${emp.monthlySalary.toLocaleString()}/mo`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {emp.joiningDate ? formatDate(emp.joiningDate) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={cn("text-[9px]", getStatusBg(emp.employmentStatus))}>
                        {emp.employmentStatus?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Edit2 className="w-3 h-3" />
                      </Button>
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
