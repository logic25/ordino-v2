import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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
  AlertCircle,
  Info,
  Plus,
  Briefcase,
} from "lucide-react";
import { useCompanyProfiles, type Profile } from "@/hooks/useProfiles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, getYear, getMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useEmployeeReviews, useCreateEmployeeReview } from "@/hooks/useEmployeeReviews";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Line, ComposedChart, Tooltip as RechartsTooltip } from "recharts";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  manager: "bg-blue-500/10 text-blue-700 border-blue-300",
  pm: "bg-green-500/10 text-green-700 border-green-300",
  accounting: "bg-amber-500/10 text-amber-700 border-amber-300",
  staff: "bg-muted text-muted-foreground border-border",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
        .limit(200);
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

function useUserBillingStats(userId: string, period: Period, monthlyGoal: number | null) {
  const range = getPeriodRange(period);

  return useQuery({
    queryKey: ["user-billing-stats-v2", userId, period, monthlyGoal],
    enabled: !!userId,
    queryFn: async () => {
      // 1. Get invoices where user is PM on the project
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .or(`assigned_pm_id.eq.${userId},senior_pm_id.eq.${userId}`);

      const projectIds = (projects || []).map((p) => p.id);

      let totalBilled = 0;
      if (projectIds.length > 0) {
        const { data: invoices } = await supabase
          .from("invoices")
          .select("total_due, created_at")
          .in("project_id", projectIds)
          .gte("created_at", format(range.start, "yyyy-MM-dd"))
          .lte("created_at", format(range.end, "yyyy-MM-dd'T'23:59:59"));
        totalBilled = (invoices || []).reduce((s, inv) => s + (Number(inv.total_due) || 0), 0);
      }

      // 2. Billing % = totalBilled / monthlyGoal
      const months = period === "this_month" || period === "last_month" ? 1 : period === "last_3" ? 3 : period === "last_6" ? 6 : 12;
      const effectiveGoal = monthlyGoal ? monthlyGoal * months : 0;
      const billingPct = effectiveGoal > 0 ? Math.round((totalBilled / effectiveGoal) * 100) : 0;

      // 3. Timelog Completion from attendance_logs
      const { data: attendanceLogs } = await supabase
        .from("attendance_logs")
        .select("log_date")
        .eq("user_id", userId)
        .gte("log_date", format(range.start, "yyyy-MM-dd"))
        .lte("log_date", format(range.end, "yyyy-MM-dd"));

      const daysClockedIn = new Set((attendanceLogs || []).map((a) => a.log_date)).size;

      const { data: timeEntries } = await supabase
        .from("activities")
        .select("activity_date")
        .eq("user_id", userId)
        .eq("activity_type", "time_log")
        .gte("activity_date", format(range.start, "yyyy-MM-dd"))
        .lte("activity_date", format(range.end, "yyyy-MM-dd"));

      const daysWithEntries = new Set((timeEntries || []).map((e) => e.activity_date)).size;
      const timelogCompletion = daysClockedIn > 0 ? Math.min(100, Math.round((daysWithEntries / daysClockedIn) * 100)) : 0;

      // 4. Hours
      const { data: allEntries } = await supabase
        .from("activities")
        .select("duration_minutes, billable")
        .eq("user_id", userId)
        .eq("activity_type", "time_log")
        .gte("activity_date", format(range.start, "yyyy-MM-dd"))
        .lte("activity_date", format(range.end, "yyyy-MM-dd"));

      const totalMinutes = (allEntries || []).reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const billableMinutes = (allEntries || []).filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes || 0), 0);

      // 5. Efficiency: weighted composite
      // Billing 53%, Timelog 40%, Non-billable CO 7% (Accuracy is N/A so weights redistribute)
      const efficiency = Math.round(billingPct * 0.53 + timelogCompletion * 0.40 + 100 * 0.07);

      // 6. Potential Bonus (tier-based on Billing %)
      let potentialBonus = 0;
      if (billingPct >= 126) potentialBonus = 1000;
      else if (billingPct >= 111) potentialBonus = 500;
      else if (billingPct >= 100) potentialBonus = 250;

      return {
        totalBilled,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        billableHours: Math.round(billableMinutes / 60 * 10) / 10,
        billingPct,
        timelogCompletion,
        efficiency,
        potentialBonus,
        monthlyGoal: effectiveGoal,
        hasGoal: !!monthlyGoal,
      };
    },
  });
}

// Billing chart data: 12 months for a given year
function useUserBillingChart(userId: string, year: number, monthlyGoal: number | null) {
  return useQuery({
    queryKey: ["user-billing-chart", userId, year, monthlyGoal],
    enabled: !!userId,
    queryFn: async () => {
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .or(`assigned_pm_id.eq.${userId},senior_pm_id.eq.${userId}`);

      const projectIds = (projects || []).map((p) => p.id);

      const chartData = [];
      for (let m = 0; m < 12; m++) {
        const start = new Date(year, m, 1);
        const end = endOfMonth(start);

        let billed = 0;
        let invoiceCount = 0;
        if (projectIds.length > 0) {
          const { data: invoices } = await supabase
            .from("invoices")
            .select("total_due")
            .in("project_id", projectIds)
            .gte("created_at", format(start, "yyyy-MM-dd"))
            .lte("created_at", format(end, "yyyy-MM-dd'T'23:59:59"));
          billed = (invoices || []).reduce((s, inv) => s + (Number(inv.total_due) || 0), 0);
          invoiceCount = (invoices || []).length;
        }

        // Proposals for estimated
        const { data: proposals } = await supabase
          .from("proposals")
          .select("total_amount")
          .or(`sales_person_id.eq.${userId},internal_signed_by.eq.${userId}`)
          .gte("created_at", format(start, "yyyy-MM-dd"))
          .lte("created_at", format(end, "yyyy-MM-dd'T'23:59:59"));
        const estimated = (proposals || []).reduce((s, p) => s + (Number(p.total_amount) || 0), 0);

        chartData.push({
          month: MONTHS[m],
          billed: Math.round(billed),
          estimated: Math.round(estimated),
          goal: monthlyGoal || 0,
          qty: invoiceCount,
          goalPct: monthlyGoal && monthlyGoal > 0 ? Math.round((billed / monthlyGoal) * 100) : 0,
        });
      }

      return chartData;
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

function StatCard({ icon: Icon, label, value, suffix, delta, tooltip, className }: {
  icon: any; label: string; value: string | number; suffix?: string;
  delta?: number; tooltip?: string; className?: string;
}) {
  const content = (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-1">
            {tooltip && <Info className="h-3 w-3 text-muted-foreground/50" />}
            {delta !== undefined && delta !== 0 && (
              <div className={cn("flex items-center gap-0.5 text-xs font-medium",
                delta > 0 ? "text-green-600" : "text-red-500"
              )}>
                {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(delta)}%
              </div>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}{suffix}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent className="max-w-[250px]">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

/* ─── Add Review Dialog ─── */
function AddReviewDialog({ employeeId, onSuccess }: { employeeId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rating, setRating] = useState("75");
  const [comments, setComments] = useState("");
  const createReview = useCreateEmployeeReview();
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      await createReview.mutateAsync({
        employee_id: employeeId,
        review_period: period,
        overall_rating: parseInt(rating),
        comments: comments || undefined,
      });
      toast({ title: "Review added" });
      setOpen(false);
      setComments("");
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add Review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Performance Review</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Review Period</Label>
            <Input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div>
            <Label>Overall Rating (0-100)</Label>
            <Input type="number" min="0" max="100" value={rating} onChange={(e) => setRating(e.target.value)} />
          </div>
          <div>
            <Label>Comments</Label>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Performance notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createReview.isPending}>
            {createReview.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Detail View ─── */
function UserDetailView({ user, onBack, onUpdate, isCurrentUser, isViewerAdmin }: {
  user: Profile; onBack: () => void; onUpdate: () => void;
  isCurrentUser: boolean; isViewerAdmin: boolean;
}) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("this_month");
  const [chartYear, setChartYear] = useState(getYear(new Date()));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const profileAny = user as any;
  const canEdit = isViewerAdmin;

  // Edit state
  const [editForm, setEditForm] = useState({
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    phone: user.phone || "",
    phone_extension: profileAny.phone_extension || "",
    hourly_rate: profileAny.hourly_rate ? String(profileAny.hourly_rate) : "",
    role: (user.role as string) || "pm",
    job_title: profileAny.job_title || "",
    about: profileAny.about || "",
    carrier: profileAny.carrier || "",
    monthly_goal: profileAny.monthly_goal ? String(profileAny.monthly_goal) : "",
    is_active: user.is_active,
  });

  const monthlyGoal = profileAny.monthly_goal ? Number(profileAny.monthly_goal) : null;

  const { data: stats, isLoading: statsLoading } = useUserBillingStats(user.id, period, monthlyGoal);
  const { data: proposals = [], isLoading: proposalsLoading } = useUserProposals(user.id);
  const { data: projects = [], isLoading: projectsLoading } = useUserProjects(user.id);
  const { data: empReviews = [], isLoading: reviewsLoading, refetch: refetchReviews } = useEmployeeReviews(user.id);
  const { data: chartData, isLoading: chartLoading } = useUserBillingChart(user.id, chartYear, monthlyGoal);

  // Proposals stats
  const totalProposals = proposals.length;
  const convertedProposals = proposals.filter((p: any) => p.status === "accepted" || p.status === "signed").length;
  const conversionRate = totalProposals > 0 ? Math.round((convertedProposals / totalProposals) * 100) : 0;
  const totalProposalValue = proposals.reduce((s: number, p: any) => s + (Number(p.total_amount) || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: editForm.first_name.trim() || null,
          last_name: editForm.last_name.trim() || null,
          phone: editForm.phone.trim() || null,
          phone_extension: editForm.phone_extension.trim() || null,
          hourly_rate: editForm.hourly_rate ? parseFloat(editForm.hourly_rate) : null,
          role: editForm.role,
          job_title: editForm.job_title.trim() || null,
          about: editForm.about.trim() || null,
          carrier: editForm.carrier.trim() || null,
          monthly_goal: editForm.monthly_goal ? parseFloat(editForm.monthly_goal) : null,
          is_active: editForm.is_active,
        } as any)
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

  const currentYear = getYear(new Date());
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

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
                {profileAny.job_title && (
                  <p className="text-sm text-muted-foreground">{profileAny.job_title}</p>
                )}
                <Badge variant="outline" className={cn("text-xs mt-1", ROLE_COLORS[user.role] || ROLE_COLORS.staff)}>
                  {user.role}
                </Badge>
                {!user.is_active && <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>}
              </div>
            </div>

            <Separator />

            {!editing ? (
              <>
                <div className="space-y-3 text-sm">
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${user.phone}`} className="hover:underline">
                        {user.phone}{profileAny.phone_extension ? ` x${profileAny.phone_extension}` : ""}
                      </a>
                    </div>
                  )}
                  {profileAny.carrier && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span className="text-xs">{profileAny.carrier}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="italic text-xs">Email available via auth</span>
                  </div>
                  {isViewerAdmin && profileAny.hourly_rate && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>${Number(profileAny.hourly_rate).toFixed(2)}/hr</span>
                    </div>
                  )}
                  {isViewerAdmin && monthlyGoal && (
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span>Goal: ${monthlyGoal.toLocaleString()}/mo</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">Member since {user.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—"}</span>
                  </div>
                  {profileAny.about && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{profileAny.about}</p>
                  )}
                </div>
                <Separator />
                {canEdit && (
                  <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">First Name</Label>
                    <Input className="h-8 text-xs" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Last Name</Label>
                    <Input className="h-8 text-xs" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Job Title</Label>
                  <Input className="h-8 text-xs" placeholder="e.g. Senior PM" value={editForm.job_title} onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="pm">PM</SelectItem>
                      <SelectItem value="accounting">Accounting</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Phone</Label>
                    <Input className="h-8 text-xs" placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Ext</Label>
                    <Input className="h-8 text-xs" placeholder="Ext" value={editForm.phone_extension} onChange={(e) => setEditForm({ ...editForm, phone_extension: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Carrier</Label>
                  <Input className="h-8 text-xs" placeholder="e.g. Verizon" value={editForm.carrier} onChange={(e) => setEditForm({ ...editForm, carrier: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Monthly Goal ($)</Label>
                    <Input className="h-8 text-xs" type="number" placeholder="33000" value={editForm.monthly_goal} onChange={(e) => setEditForm({ ...editForm, monthly_goal: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Hourly Rate ($)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={editForm.hourly_rate} onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">About</Label>
                  <Textarea className="text-xs min-h-[60px]" placeholder="Short bio..." value={editForm.about} onChange={(e) => setEditForm({ ...editForm, about: e.target.value })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Active</Label>
                  <Switch checked={editForm.is_active} onCheckedChange={(v) => setEditForm({ ...editForm, is_active: v })} />
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 gap-1" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Stat Cards */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Performance
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
                  <StatCard
                    icon={Target}
                    label="Billing %"
                    value={stats?.hasGoal ? stats.billingPct : "—"}
                    suffix={stats?.hasGoal ? "%" : ""}
                    tooltip="Revenue billed on your projects vs. your monthly goal"
                  />
                  <StatCard
                    icon={AlertCircle}
                    label="Non-Billable COs"
                    value="$0"
                    tooltip="Dollar value of change orders caused by mistakes that couldn't be billed to the client"
                  />
                  <StatCard
                    icon={CheckCircle}
                    label="Timelog Completion"
                    value={stats?.timelogCompletion || 0}
                    suffix="%"
                    tooltip="Of the days you clocked in, what % had time logged? PTO/sick days excluded"
                  />
                  <StatCard
                    icon={BarChart3}
                    label="Accuracy"
                    value="N/A"
                    tooltip="How accurate your estimated completion dates are vs. actual. Available when estimated dates are added to services"
                  />
                  <StatCard
                    icon={Zap}
                    label="Efficiency Rating"
                    value={stats?.efficiency || 0}
                    suffix="%"
                    tooltip="Weighted composite of your performance metrics. Billing 53%, Timelog 40%, Non-billable CO 7%"
                  />
                  <StatCard
                    icon={Award}
                    label="Potential Bonus"
                    value={`$${stats?.potentialBonus || 0}`}
                    tooltip="Estimated bonus based on monthly billing goal attainment. Tiers: 100-110% = $250, 111-125% = $500, 126%+ = $1,000"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="billing">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="billing" className="gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Billing
                  </TabsTrigger>
                  <TabsTrigger value="proposals" className="gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Proposals ({totalProposals})
                  </TabsTrigger>
                  <TabsTrigger value="projects" className="gap-1">
                    <FolderKanban className="h-3.5 w-3.5" />
                    Projects ({projects.length})
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="gap-1">
                    <Star className="h-3.5 w-3.5" />
                    Reviews ({empReviews.length})
                  </TabsTrigger>
                </TabsList>

                {/* Billing Tab */}
                <TabsContent value="billing" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Monthly Billing</h4>
                    <Select value={String(chartYear)} onValueChange={(v) => setChartYear(Number(v))}>
                      <SelectTrigger className="w-[100px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {chartLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : chartData ? (
                    <>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <RechartsTooltip
                              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                              formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="billed" fill="hsl(var(--primary))" name="Billed" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="estimated" fill="hsl(var(--accent))" name="Estimated" radius={[4, 4, 0, 0]} />
                            <Line dataKey="goal" stroke="hsl(var(--destructive))" strokeDasharray="5 5" name="Goal" dot={false} strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead className="text-right">QTY</TableHead>
                            <TableHead className="text-right">Billed</TableHead>
                            <TableHead className="text-right">Goal</TableHead>
                            <TableHead className="text-right">Goal %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chartData.map((d) => (
                            <TableRow key={d.month}>
                              <TableCell className="text-sm">{d.month}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{d.qty}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">${d.billed.toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">${d.goal.toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                <Badge variant={d.goalPct >= 100 ? "default" : "secondary"} className="text-xs">
                                  {d.goalPct}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  ) : null}
                </TabsContent>

                {/* Proposals Tab */}
                <TabsContent value="proposals" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-xl font-bold">{totalProposals}</p>
                        <p className="text-[10px] text-muted-foreground">Total Written</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-xl font-bold">{convertedProposals}</p>
                        <p className="text-[10px] text-muted-foreground">Converted</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-xl font-bold">{conversionRate}%</p>
                        <p className="text-[10px] text-muted-foreground">Conversion Rate</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-xl font-bold">${(totalProposalValue / 1000).toFixed(0)}k</p>
                        <p className="text-[10px] text-muted-foreground">Total Value</p>
                      </CardContent>
                    </Card>
                  </div>

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

                {/* Projects Tab */}
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

                {/* Reviews Tab - Employee Performance Reviews */}
                <TabsContent value="reviews" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Performance Reviews</h4>
                    {isViewerAdmin && (
                      <AddReviewDialog employeeId={user.id} onSuccess={() => refetchReviews()} />
                    )}
                  </div>

                  {reviewsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : empReviews.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">No performance reviews yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {empReviews.map((r) => {
                        const reviewerName = r.reviewer?.display_name ||
                          [r.reviewer?.first_name, r.reviewer?.last_name].filter(Boolean).join(" ") || "Unknown";
                        return (
                          <Card key={r.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-sm">
                                    {format(new Date(r.review_period), "MMMM yyyy")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">by {reviewerName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={
                                    (r.overall_rating || 0) >= 80 ? "default" :
                                      (r.overall_rating || 0) >= 60 ? "secondary" : "destructive"
                                  }>
                                    {r.overall_rating}/100
                                  </Badge>
                                  {r.previous_rating !== null && r.previous_rating !== undefined && (
                                    <span className={cn("text-xs",
                                      (r.overall_rating || 0) > r.previous_rating ? "text-green-600" : "text-red-500"
                                    )}>
                                      {(r.overall_rating || 0) > r.previous_rating ? "↑" : "↓"} from {r.previous_rating}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {r.comments && <p className="text-sm mt-2 text-muted-foreground">{r.comments}</p>}
                              <p className="text-[10px] text-muted-foreground mt-2">
                                {r.created_at ? format(new Date(r.created_at), "MMM d, yyyy") : ""}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
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
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  // Get current user's profile id
  const currentProfileId = profiles.find((p) => p.user_id === user?.id)?.id;

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    const name = (p.display_name || `${p.first_name} ${p.last_name}`).toLowerCase();
    return name.includes(q) || p.role?.toLowerCase().includes(q);
  });

  const activeCount = profiles.filter((p) => p.is_active).length;

  const handleUserClick = (profile: Profile) => {
    // Non-admins can only view their own profile
    if (!isAdmin && profile.id !== currentProfileId) return;
    setSelectedUser(profile);
  };

  if (selectedUser) {
    return (
      <UserDetailView
        user={selectedUser}
        onBack={() => setSelectedUser(null)}
        onUpdate={() => { refetch(); setSelectedUser(null); }}
        isCurrentUser={selectedUser.id === currentProfileId}
        isViewerAdmin={isAdmin}
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
                {filteredProfiles.map((profile) => {
                  const canClick = isAdmin || profile.id === currentProfileId;
                  return (
                    <TableRow
                      key={profile.id}
                      className={cn(
                        canClick ? "cursor-pointer hover:bg-muted/50" : "opacity-70",
                        !profile.is_active && "opacity-50"
                      )}
                      onClick={() => handleUserClick(profile)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{getInitials(profile)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium">{getDisplayName(profile)}</span>
                            {(profile as any).job_title && (
                              <p className="text-xs text-muted-foreground">{(profile as any).job_title}</p>
                            )}
                          </div>
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
    </div>
  );
}
