import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  TrendingUp,
  TrendingDown,
  Star,
  Pencil,
  Save,
  X,
  BarChart3,
  Target,
  CheckCircle,
  Zap,
  Award,
} from "lucide-react";
import { useCompanyProfiles, type Profile } from "@/hooks/useProfiles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  manager: "bg-blue-500/10 text-blue-700 border-blue-300",
  pm: "bg-green-500/10 text-green-700 border-green-300",
  accounting: "bg-amber-500/10 text-amber-700 border-amber-300",
  staff: "bg-muted text-muted-foreground border-border",
};

/* ─── Hooks ─── */

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

function useUserReviews(userId: string) {
  return useQuery({
    queryKey: ["user-reviews", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_reviews")
        .select("id, rating, comment, category_ratings, created_at, clients(name), projects(name)")
        .eq("reviewer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

type Period = "this_month" | "last_month" | "last_3" | "last_6" | "last_12";

function getPeriodRange(period: Period) {
  const now = new Date();
  switch (period) {
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const last = subMonths(now, 1);
      return { start: startOfMonth(last), end: endOfMonth(last) };
    }
    case "last_3":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "last_6":
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    case "last_12":
      return { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now) };
  }
}

function useUserBillingStats(userId: string, period: Period) {
  const range = getPeriodRange(period);
  const prevRange = (() => {
    const months = period === "this_month" ? 1 : period === "last_month" ? 1 : period === "last_3" ? 3 : period === "last_6" ? 6 : 12;
    const prevEnd = subMonths(range.start, 1);
    const prevStart = subMonths(range.start, months);
    return { start: startOfMonth(prevStart), end: endOfMonth(prevEnd) };
  })();

  return useQuery({
    queryKey: ["user-billing-stats", userId, period],
    enabled: !!userId,
    queryFn: async () => {
      // Current period time entries
      const { data: currentEntries } = await supabase
        .from("activities")
        .select("duration_minutes, billable, activity_date")
        .eq("user_id", userId)
        .eq("activity_type", "time_log")
        .gte("activity_date", format(range.start, "yyyy-MM-dd"))
        .lte("activity_date", format(range.end, "yyyy-MM-dd"));

      // Previous period for comparison
      const { data: prevEntries } = await supabase
        .from("activities")
        .select("duration_minutes, billable")
        .eq("user_id", userId)
        .eq("activity_type", "time_log")
        .gte("activity_date", format(prevRange.start, "yyyy-MM-dd"))
        .lte("activity_date", format(prevRange.end, "yyyy-MM-dd"));

      const entries = currentEntries || [];
      const prev = prevEntries || [];

      const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const billableMinutes = entries.filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const billingPct = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0;

      const prevTotal = prev.reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const prevBillable = prev.filter(e => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const prevBillingPct = prevTotal > 0 ? Math.round((prevBillable / prevTotal) * 100) : 0;

      // Timelog completion: days with entries / business days in period
      const uniqueDays = new Set(entries.map(e => e.activity_date)).size;
      const totalDaysInPeriod = Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
      const businessDays = Math.round(totalDaysInPeriod * 5 / 7);
      const effectiveBusinessDays = Math.min(businessDays, Math.ceil((new Date().getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) * 5 / 7);
      const timelogCompletion = effectiveBusinessDays > 0 ? Math.min(100, Math.round((uniqueDays / Math.max(1, effectiveBusinessDays)) * 100)) : 0;

      const prevUniqueDays = new Set((prevEntries || []).map((e: any) => e.activity_date)).size;

      // Efficiency: billable hours / 8hr standard day * logged days
      const expectedMinutes = uniqueDays * 480; // 8 hours * 60
      const efficiency = expectedMinutes > 0 ? Math.round((billableMinutes / expectedMinutes) * 100) : 0;

      // Potential bonus: if billing % > 75, show estimated bonus
      const potentialBonus = billingPct >= 75 ? Math.round(billableMinutes / 60 * 5) : 0; // $5 per billable hour above threshold

      return {
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        billableHours: Math.round(billableMinutes / 60 * 10) / 10,
        billingPct,
        billingPctDelta: billingPct - prevBillingPct,
        timelogCompletion,
        timelogCompletionDelta: timelogCompletion - (prevTotal > 0 ? Math.min(100, Math.round((prevUniqueDays / Math.max(1, effectiveBusinessDays)) * 100)) : 0),
        efficiency,
        potentialBonus,
      };
    },
  });
}

/* ─── Components ─── */

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

function StatCard({ icon: Icon, label, value, suffix, delta, className }: {
  icon: any; label: string; value: string | number; suffix?: string;
  delta?: number; className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {delta !== undefined && delta !== 0 && (
            <div className={cn("flex items-center gap-0.5 text-xs font-medium",
              delta > 0 ? "text-green-600" : "text-red-500"
            )}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta)}%
            </div>
          )}
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}{suffix}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

/* ─── Detail View ─── */
function UserDetailView({ user, onBack, onUpdate }: { user: Profile; onBack: () => void; onUpdate: () => void }) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("this_month");
  const [editing, setEditing] = useState(false);
  const [editPhone, setEditPhone] = useState(user.phone || "");
  const [editExt, setEditExt] = useState((user as any).phone_extension || "");
  const [editRate, setEditRate] = useState((user as any).hourly_rate ? String((user as any).hourly_rate) : "");
  const [editRole, setEditRole] = useState<"admin" | "manager" | "pm" | "accounting">(
    (user.role as any) || "pm"
  );
  const [saving, setSaving] = useState(false);

  const { data: stats, isLoading: statsLoading } = useUserBillingStats(user.id, period);
  const { data: proposals = [], isLoading: proposalsLoading } = useUserProposals(user.id);
  const { data: projects = [], isLoading: projectsLoading } = useUserProjects(user.id);
  const { data: reviews = [], isLoading: reviewsLoading } = useUserReviews(user.id);

  const profileAny = user as any;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          phone: editPhone.trim() || null,
          phone_extension: editExt.trim() || null,
          hourly_rate: editRate ? parseFloat(editRate) : null,
          role: editRole,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast({ title: "Profile updated" });
      setEditing(false);
      onUpdate();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
                {!editing ? (
                  <>
                    <Badge variant="outline" className={cn("text-xs mt-1", ROLE_COLORS[user.role] || ROLE_COLORS.staff)}>
                      {user.role}
                    </Badge>
                    {!user.is_active && <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>}
                  </>
                ) : (
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as "admin" | "manager" | "pm" | "accounting")}>
                    <SelectTrigger className="h-7 w-32 mx-auto mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="pm">PM</SelectItem>
                      <SelectItem value="accounting">Accounting</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3 text-sm">
              {!editing ? (
                <>
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${user.phone}`} className="hover:underline">
                        {user.phone}{profileAny.phone_extension ? ` x${profileAny.phone_extension}` : ""}
                      </a>
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
                </>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Input className="col-span-2 h-8 text-xs" placeholder="Phone" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    <Input className="h-8 text-xs" placeholder="Ext" value={editExt} onChange={e => setEditExt(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="h-8 text-xs" type="number" step="0.01" placeholder="Rate" value={editRate} onChange={e => setEditRate(e.target.value)} />
                    <span className="text-xs text-muted-foreground">/hr</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Member since {user.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—"}</span>
              </div>
            </div>

            <Separator />

            {!editing ? (
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Billing Stats */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Billing Performance
                </CardTitle>
                <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="last_3">Last 3 Months</SelectItem>
                    <SelectItem value="last_6">Last 6 Months</SelectItem>
                    <SelectItem value="last_12">Last 12 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard icon={Target} label="Billing %" value={stats?.billingPct || 0} suffix="%" delta={stats?.billingPctDelta} />
                  <StatCard icon={CheckCircle} label="Timelog Completion" value={stats?.timelogCompletion || 0} suffix="%" delta={stats?.timelogCompletionDelta} />
                  <StatCard icon={Zap} label="Efficiency Rating" value={stats?.efficiency || 0} suffix="%" />
                  <StatCard icon={Clock} label="Total Hours" value={stats?.totalHours || 0} suffix="h" />
                  <StatCard icon={DollarSign} label="Billable Hours" value={stats?.billableHours || 0} suffix="h" />
                  <StatCard icon={Award} label="Potential Bonus" value={`$${stats?.potentialBonus || 0}`} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
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
                  <TabsTrigger value="reviews" className="gap-1">
                    <Star className="h-3.5 w-3.5" />
                    Reviews ({reviews.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="proposals" className="mt-4">
                  {proposalsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : proposals.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">No proposals found.</p>
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
                    <p className="text-center py-8 text-muted-foreground text-sm">No projects found.</p>
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

                <TabsContent value="reviews" className="mt-4">
                  {reviewsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : reviews.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">No reviews written by this user.</p>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((r: any) => (
                        <Card key={r.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">{r.clients?.name || "Unknown Client"}</p>
                                {r.projects?.name && (
                                  <p className="text-xs text-muted-foreground">{r.projects.name}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} className={cn("h-3.5 w-3.5", s <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
                                ))}
                              </div>
                            </div>
                            {r.comment && <p className="text-sm mt-2 text-muted-foreground">{r.comment}</p>}
                            <p className="text-[10px] text-muted-foreground mt-2">
                              {r.created_at ? format(new Date(r.created_at), "MMM d, yyyy") : ""}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── Team List ─── */
export function TeamSettings() {
  const { data: profiles = [], isLoading, refetch } = useCompanyProfiles();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    const name = (p.display_name || `${p.first_name} ${p.last_name}`).toLowerCase();
    return name.includes(q) || p.role?.toLowerCase().includes(q);
  });

  const activeCount = profiles.filter((p) => p.is_active).length;

  if (selectedUser) {
    return (
      <UserDetailView
        user={selectedUser}
        onBack={() => setSelectedUser(null)}
        onUpdate={() => { refetch(); setSelectedUser(null); }}
      />
    );
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
