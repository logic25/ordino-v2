import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Search,
  Loader2,
  Mail,
  Phone,
  Shield,
  Clock,
  FolderKanban,
} from "lucide-react";
import { useCompanyProfiles, type Profile } from "@/hooks/useProfiles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  manager: "bg-blue-500/10 text-blue-700 border-blue-300",
  pm: "bg-green-500/10 text-green-700 border-green-300",
  staff: "bg-muted text-muted-foreground border-border",
};

function useUserStats(userId: string) {
  return useQuery({
    queryKey: ["user-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count: projectCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .or(`assigned_pm_id.eq.${userId}`)
        .in("status", ["open"] as any[]);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { data: timeEntries } = await supabase
        .from("activities")
        .select("duration_minutes")
        .eq("user_id", userId)
        .eq("activity_type", "time_log")
        .gte("activity_date", startOfMonth.toISOString().split("T")[0]);

      const totalMinutes = timeEntries?.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) || 0;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      return {
        activeProjects: projectCount || 0,
        hoursThisMonth: Math.round((totalMinutes / 60) * 10) / 10,
        appRoles: (roles || []).map((r: any) => r.role as string),
      };
    },
  });
}

function UserDetailSheet({ user, open, onClose }: { user: Profile | null; open: boolean; onClose: () => void }) {
  const { data: stats, isLoading } = useUserStats(user?.id || "");

  if (!user) return null;

  const initials = [user.first_name, user.last_name]
    .filter(Boolean)
    .map((n) => n?.[0])
    .join("")
    .toUpperCase() || "?";

  const displayName = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unknown";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Team Member</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{displayName}</h3>
              <Badge variant="outline" className={cn("text-xs", ROLE_COLORS[user.role] || ROLE_COLORS.staff)}>
                {user.role}
              </Badge>
              {!user.is_active && <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Contact</h4>
            {user.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {user.phone}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="italic">Email available via auth</span>
            </div>
          </div>

          <Separator />

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Activity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <FolderKanban className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xl font-bold tabular-nums">{stats?.activeProjects || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Active Projects</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xl font-bold tabular-nums">{stats?.hoursThisMonth || 0}h</p>
                      <p className="text-[10px] text-muted-foreground">Hours (Month)</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {stats?.appRoles && stats.appRoles.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      Access Roles
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {stats.appRoles.map((role) => (
                        <Badge key={role} variant="outline" className={cn("text-xs", ROLE_COLORS[role] || ROLE_COLORS.staff)}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Member since {user.created_at ? format(new Date(user.created_at), "MMMM d, yyyy") : "—"}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TeamSettings() {
  const { data: profiles = [], isLoading } = useCompanyProfiles();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    const name = (p.display_name || `${p.first_name} ${p.last_name}`).toLowerCase();
    return name.includes(q) || p.role?.toLowerCase().includes(q);
  });

  const activeCount = profiles.filter((p) => p.is_active).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-around gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{profiles.length}</p>
              <p className="text-xs text-muted-foreground">Total Members</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-2xl font-bold text-primary">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-2xl font-bold">{profiles.length - activeCount}</p>
              <p className="text-xs text-muted-foreground">Inactive</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search team members..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
            <span className="text-muted-foreground font-normal text-sm">({filteredProfiles.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No team members found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((profile) => {
                  const initials = [profile.first_name, profile.last_name]
                    .filter(Boolean)
                    .map((n) => n?.[0])
                    .join("")
                    .toUpperCase() || "?";
                  const displayName = profile.display_name ||
                    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown";

                  return (
                    <TableRow
                      key={profile.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedUser(profile)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", ROLE_COLORS[profile.role] || ROLE_COLORS.staff)}>
                          {profile.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{profile.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={profile.is_active ? "default" : "secondary"} className="text-xs">
                          {profile.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {profile.created_at ? format(new Date(profile.created_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UserDetailSheet user={selectedUser} open={!!selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
