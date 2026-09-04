import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatDate, getStatusBg } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Calendar,
  Clock,
  Globe,
  DollarSign,
  Activity,
  Plus,
  Trash2,
  Save,
  Building2,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role && user?.role !== "employee";

  const settings = useQuery(api.settings.getAll);
  const holidays = useQuery(api.settings.listHolidays, {});
  const activities = useQuery(api.activities.list);
  const departments = useQuery(api.departments.list);
  const teams = useQuery(api.teams.list, {});
  const updateSetting = useMutation(api.settings.set);

  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <SettingsIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            Access Restricted
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Settings are only available to administrators.
          </p>
        </div>
      </div>
    );
  }

  const handleSaveSetting = async (key: string) => {
    const value = editedSettings[key];
    if (value === undefined) return;
    try {
      await updateSetting({ key, value });
      toast.success(`Setting "${key}" updated`);
      setEditedSettings((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to update setting");
    }
  };

  const settingGroups = [
    {
      title: "General",
      icon: SettingsIcon,
      settings: ["company_name", "timezone", "currency", "working_week"],
    },
    {
      title: "Attendance Rules",
      icon: Clock,
      settings: ["grace_period", "overtime_threshold", "break_duration"],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5 max-w-4xl"
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          System configuration and management
        </p>
      </div>

      {/* System Settings */}
      {settingGroups.map((group) => (
        <Card key={group.title} className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-terminal-green/10 flex items-center justify-center">
                <group.icon className="w-3.5 h-3.5 text-terminal-green" />
              </div>
              {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {group.settings.map((key) => {
              const setting = settings?.find((s) => s.key === key);
              const isEdited = key in editedSettings;
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium">
                      {setting?.description ?? key}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {key}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={
                        isEdited
                          ? editedSettings[key]
                          : setting?.value ?? ""
                      }
                      onChange={(e) =>
                        setEditedSettings((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="h-7 w-48 text-xs font-mono"
                    />
                    {isEdited && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveSetting(key)}
                        className="h-7 px-2 border-terminal-green text-terminal-green"
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Holidays */}
      <Card className="terminal-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-terminal-amber/10 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-terminal-amber" />
              </div>
              Holidays
            </CardTitle>
            <Button
              size="sm"
              className="gap-1.5 h-7 text-[10px] bg-terminal-green hover:bg-terminal-green/90 text-white"
            >
              <Plus className="w-3 h-3" /> Add Holiday
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Year</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Recurring</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No holidays configured
                    </td>
                  </tr>
                )}
                {holidays?.map((h) => (
                  <tr key={h._id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{h.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(h.date)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{h.year}</td>
                    <td className="px-4 py-2">
                      {h.isRecurring ? (
                        <Badge variant="outline" className="text-[9px] bg-terminal-green/10 text-terminal-green border-terminal-green/20">
                          Recurring
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">
                          One-time
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{h.description ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-terminal-red hover:text-terminal-red">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Activity Types */}
      <Card className="terminal-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-purple-600" />
              </div>
              Activity Types
            </CardTitle>
            <Button
              size="sm"
              className="gap-1.5 h-7 text-[10px] bg-terminal-green hover:bg-terminal-green/90 text-white"
            >
              <Plus className="w-3 h-3" /> Add Activity
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
            {activities?.map((a) => (
              <div
                key={a._id}
                className="flex items-center justify-between p-3 rounded border border-border bg-background"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: a.color ?? "#6b6b6b" }}
                  />
                  <div>
                    <p className="text-xs font-medium">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{a.code}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px]",
                    a.isActive
                      ? "bg-terminal-green/10 text-terminal-green border-terminal-green/20"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {a.isActive ? "ACTIVE" : "INACTIVE"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Organization Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-terminal-green/10 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-terminal-green" />
              </div>
              Departments ({departments?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {departments?.map((d) => (
                <div key={d._id} className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{d.code}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {d.employeeCount} employees
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="terminal-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-terminal-blue/10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-terminal-blue" />
              </div>
              Teams ({teams?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {teams?.map((t) => (
                <div key={t._id} className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.departmentName ?? "—"}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {t.employeeCount} members
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
