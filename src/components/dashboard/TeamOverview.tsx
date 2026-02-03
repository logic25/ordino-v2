import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp } from "lucide-react";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function TeamOverview() {
  const { data: profiles, isLoading } = useCompanyProfiles();

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-purple-500/10 text-purple-600",
      manager: "bg-blue-500/10 text-blue-600",
      pm: "bg-green-500/10 text-green-600",
      accounting: "bg-amber-500/10 text-amber-600",
    };
    return (
      <Badge className={colors[role] || "bg-muted"}>
        {role.toUpperCase()}
      </Badge>
    );
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Overview
        </CardTitle>
        <CardDescription>Active team members</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </>
        ) : !profiles || profiles.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No team members found
          </p>
        ) : (
          <>
            {profiles.slice(0, 5).map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(profile.first_name, profile.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {profile.first_name} {profile.last_name}
                    </p>
                  </div>
                </div>
                {getRoleBadge(profile.role)}
              </div>
            ))}
            {profiles.length > 5 && (
              <Button variant="ghost" className="w-full text-sm">
                +{profiles.length - 5} more
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
