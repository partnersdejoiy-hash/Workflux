import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users } from "lucide-react";

export default function Departments() {
  const departments = useQuery(api.departments.list);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Departments</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {departments?.length ?? 0} departments
          </p>
        </div>
        <Button className="gap-2 self-start bg-terminal-green hover:bg-terminal-green/90 text-white">
          <Plus className="w-3.5 h-3.5" />
          Add Department
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments?.map((dept) => (
          <Card key={dept._id} className="terminal-card hover:bg-muted/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded bg-terminal-green/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-terminal-green" />
                </div>
                <Badge variant="outline" className="text-[9px]">
                  {dept.code}
                </Badge>
              </div>
              <h3 className="text-sm font-medium">{dept.name}</h3>
              {dept.description && (
                <p className="text-[10px] text-muted-foreground mt-1">{dept.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {dept.employeeCount} employees
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
