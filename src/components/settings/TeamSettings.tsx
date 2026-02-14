import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  Loader2,
  Mail,
  Phone,
  Clock,
  FolderKanban,
  ChevronLeft,
  DollarSign,
  FileText,
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

function useUserProposals(userId: string) {
  return useQuery({
    queryKey: ["user-proposals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, proposal_number, project_name, status, total_amount, created_at")
        .or(`sales_person_id.eq.${userId},internal_signed_by.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

function useUserProjects(userId: string) {
  return useQuery({
    queryKey: ["user-projects", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, name, status, created_at, properties(address)")
        .or(`assigned_pm_id.eq.${userId},senior_pm_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

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

      return {
        activeProjects: projectCount || 0,
        hoursThisMonth: Math.round((totalMinutes / 60) * 10) / 10,
      };
    },
  });
}

function getInitials(user: Profile) {
  return [user.first_name, user.last_name]
    .filter(Boolean)
    .map((n) => n?.[0])
    .join("")
    .toUpperCase() || "?";
}

function getDisplayName(user: Profile) {
  return user.display_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unknown";
}

/* ─── Detail View ─── */
function UserDetailView({ user, onBack }: { user: Profile; onBack: () => void }) {
  const { data: stats, isLoading: statsLoading } = useUserStats(user.id);
  const { data: proposals = [], isLoading: proposalsLoading } = useUserProposals(user.id);
  const { data: projects = [], isLoading: projectsLoading } = useUserProjects(user.id);

  const profileAny = user as any;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ChevronLeft className="h-4 w-4" />
        Back to Team
      </Button>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-xl">{getInitials(user)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{getDisplayName(user)}</h3>
                <Badge variant="outline" className={cn("text-xs mt-1", ROLE_COLORS[user.role] || ROLE_COLORS.staff)}>
                  {user.role}
                </Badge>
                {!user.is_active && <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>}
              </div>
            </div>

            <Separator />

            <div className="space-y-3 text-sm">
              {user.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user.phone}{profileAny.phone_extension ? ` x${profileAny.phone_extension}` : ""}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="italic text-xs">Email available via auth</span>
              </div>
              {profileAny.hourly_rate && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>${Number(profileAny.hourly_rate).toFixed(2)}/hr</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Member since {user.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—"}</span>
              </div>
            </div>

            <Separator />

            {statsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <Tabs defaultValue="proposals">
              <TabsList>
                <TabsTrigger value="proposals" className="gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Proposals ({proposals.length})
                </TabsTrigger>
                <TabsTrigger value="projects" className="gap-1">
                  <FolderKanban className="h-3.5 w-3.5" />
                  Projects ({projects.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="proposals" className="mt-4">
                {proposalsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : proposals.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">No proposals found for this user.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {proposals.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.proposal_number || "—"}</TableCell>
                          <TableCell className="text-sm">{p.project_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {p.total_amount ? `$${Number(p.total_amount).toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {p.created_at ? format(new Date(p.created_at), "MMM d, yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="projects" className="mt-4">
                {projectsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : projects.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">No projects found for this user.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.project_number || "—"}</TableCell>
                          <TableCell className="text-sm font-medium">{p.name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.properties?.address || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {p.created_at ? format(new Date(p.created_at), "MMM d, yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Team List ─── */
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

  if (selectedUser) {
    return <UserDetailView user={selectedUser} onBack={() => setSelectedUser(null)} />;
  }

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
                {filteredProfiles.map((profile) => (
                  <TableRow
                    key={profile.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      !profile.is_active && "opacity-50"
                    )}
                    onClick={() => setSelectedUser(profile)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{getInitials(profile)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{getDisplayName(profile)}</span>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
