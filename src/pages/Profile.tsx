import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, getStatusBg } from "@/lib/utils";
import {
  User,
  Mail,
  Phone,
  Building2,
  Users,
  Calendar,
  Clock,
  Shield,
  DollarSign,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Profile() {
  const { user } = useAuth();
  const profile = useQuery(api.employees.getMyProfile);
  const myAssignment = useQuery(api.shifts.getMyAssignment);
  const myHistory = useQuery(api.attendance.getMyHistory, { days: 30 });

  // Calculate monthly stats from history
  const totalDaysWorked = myHistory?.filter(
    (s) =>
      s.status === "shift_completed" ||
      s.status === "overtime" ||
      s.status === "early_leave"
  ).length ?? 0;

  const totalHours =
    myHistory?.reduce((sum, s) => sum + (s.netMinutes ?? 0), 0) ?? 0;
  const totalOvertime =
    myHistory?.reduce((sum, s) => sum + (s.overtimeMinutes ?? 0), 0) ?? 0;

  if (!profile) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5 max-w-3xl"
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your personal and employment details
        </p>
      </div>

      {/* Profile Header Card */}
      <Card className="terminal-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-terminal-green/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-terminal-green">
                {profile.firstName?.charAt(0)}
                {profile.lastName?.charAt(0)}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">
                {profile.firstName} {profile.lastName}
              </h2>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px]",
                    getStatusBg(profile.employmentStatus)
                  )}
                >
                  {profile.employmentStatus?.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-[9px]">
                  {profile.employeeId}
                </Badge>
                {user?.role && (
                  <Badge variant="outline" className="text-[9px]">
                    {user.role === "super_admin"
                      ? "Super Admin"
                      : user.role === "hr_admin"
                      ? "HR Admin"
                      : user.role === "manager"
                      ? "Manager"
                      : user.role === "payroll_admin"
                      ? "Payroll Admin"
                      : "Employee"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal Info */}
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <InfoRow icon={User} label="Full Name" value={`${profile.firstName} ${profile.lastName}`} />
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={Phone} label="Phone" value={profile.phone ?? "Not provided"} />
            <InfoRow icon={Shield} label="Employee ID" value={profile.employeeId} />
            <InfoRow icon={Calendar} label="Joined" value={formatDate(profile.joiningDate)} />
          </CardContent>
        </Card>

        {/* Employment Info */}
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Employment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <InfoRow icon={Building2} label="Department" value={profile.departmentName} />
            <InfoRow icon={Users} label="Team" value={profile.teamName ?? "Not assigned"} />
            <InfoRow icon={User} label="Designation" value={profile.designationName ?? "Not assigned"} />
            <InfoRow icon={User} label="Manager" value={profile.managerName ?? "Not assigned"} />
            <InfoRow icon={Clock} label="Timezone" value={profile.timezone} />
          </CardContent>
        </Card>

        {/* Pay Info */}
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Compensation
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <InfoRow
              icon={DollarSign}
              label="Pay Type"
              value={profile.payType === "hourly" ? "Hourly" : "Salaried"}
            />
            {profile.payType === "hourly" ? (
              <InfoRow
                icon={DollarSign}
                label="Hourly Rate"
                value={`$${profile.hourlyRate}/hr`}
              />
            ) : (
              <InfoRow
                icon={DollarSign}
                label="Monthly Salary"
                value={profile.monthlySalary ? `$${profile.monthlySalary.toLocaleString()}` : "—"}
              />
            )}
            <InfoRow
              icon={DollarSign}
              label="Overtime Multiplier"
              value={`${profile.overtimeMultiplier}x`}
            />
            <InfoRow
              icon={DollarSign}
              label="Holiday Multiplier"
              value={`${profile.holidayMultiplier}x`}
            />
          </CardContent>
        </Card>

        {/* Monthly Stats */}
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <InfoRow
              icon={Calendar}
              label="Days Worked"
              value={`${totalDaysWorked} days`}
            />
            <InfoRow
              icon={Clock}
              label="Total Hours"
              value={`${Math.round(totalHours / 60 * 10) / 10}h`}
            />
            <InfoRow
              icon={Clock}
              label="Overtime Hours"
              value={`${Math.round(totalOvertime / 60 * 10) / 10}h`}
            />
            <InfoRow
              icon={Clock}
              label="Avg Hours/Day"
              value={
                totalDaysWorked > 0
                  ? `${Math.round((totalHours / totalDaysWorked / 60) * 10) / 10}h`
                  : "—"
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Shift Assignment */}
      {myAssignment?.shift && (
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Current Shift Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Shift</p>
                <p className="text-sm font-medium mt-0.5">{myAssignment.shift.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Schedule</p>
                <p className="text-sm font-medium mt-0.5">
                  {myAssignment.shift.startTime} — {myAssignment.shift.endTime}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Grace Period</p>
                <p className="text-sm font-medium mt-0.5">{myAssignment.shift.gracePeriodMinutes} min</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Min Hours</p>
                <p className="text-sm font-medium mt-0.5">{myAssignment.shift.minimumWorkingHours}h</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overtime After</p>
                <p className="text-sm font-medium mt-0.5">{myAssignment.shift.overtimeThresholdHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
