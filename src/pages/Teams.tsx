import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Building2 } from "lucide-react";

export default function Teams() {
  const teams = useQuery(api.teams.list, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Teams</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{teams?.length ?? 0} teams</p>
        </div>
        <Button className="gap-2 self-start bg-terminal-green hover:bg-terminal-green/90 text-white">
          <Plus className="w-3.5 h-3.5" /> Add Team
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams?.map((team) => (
          <Card key={team._id} className="terminal-card hover:bg-muted/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded bg-terminal-blue/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-terminal-blue" />
                </div>
                <Badge variant="outline" className="text-[9px]">{team.code}</Badge>
              </div>
              <h3 className="text-sm font-medium">{team.name}</h3>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {team.departmentName ?? "—"}
              </p>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{team.employeeCount} members</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
