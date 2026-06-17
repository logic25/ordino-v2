import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useEmployeeReviews, useCreateEmployeeReview, useUpdateEmployeeReview } from "@/hooks/useEmployeeReviews";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Line, ComposedChart, Tooltip as RechartsTooltip } from "recharts";
import { InviteMemberDialog } from "./InviteMemberDialog";

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
        .select("id, proposal_number, title, status, total_amount, created_at")
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

interface BonusTier { min_pct: number; max_pct: number; amount: number; }

const DEFAULT_BONUS_TIERS: BonusTier[] = [
  { min_pct: 100, max_pct: 110, amount: 250 },
  { min_pct: 111, max_pct: 125, amount: 500 },
  { min_pct: 126, max_pct: 999, amount: 1000 },
];

// Role-aware metric profile
type MetricKind = "pm" | "accounting" | "generic";
function getMetricProfile(role: string | null | undefined): MetricKind {
  const r = (role || "").toLowerCase();
  if (r === "accounting") return "accounting";
  if (r === "admin" || r === "pm" || r === "senior_pm" || r === "production" || r === "manager") return "pm";
  return "generic";
}

// Accounting KPIs: invoices issued, $ invoiced, time-to-invoice, backlog, collection rate
function useAccountingStats(userId: string, period: Period, monthlyInvoiceGoal: number | null) {
  const range = getPeriodRange(period);
  return useQuery({
    queryKey: ["user-accounting-stats", userId, period, monthlyInvoiceGoal],
    enabled: !!userId,
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, total_due, created_at, paid_at, payment_amount, billing_request_id, status")
        .eq("created_by", userId)
        .gte("created_at", format(range.start, "yyyy-MM-dd"))
        .lte("created_at", format(range.end, "yyyy-MM-dd'T'23:59:59"));

      const invList = invoices || [];
      const invoicesIssued = invList.length;
      const totalInvoiced = invList.reduce((s, i) => s + (Number(i.total_due) || 0), 0);

      const reqIds = invList.map((i) => i.billing_request_id).filter(Boolean) as string[];
      let avgHoursToInvoice: number | null = null;
      if (reqIds.length > 0) {
        const { data: reqs } = await supabase
          .from("billing_requests")
          .select("id, created_at")
          .in("id", reqIds);
        const reqMap = new Map((reqs || []).map((r: any) => [r.id, new Date(r.created_at).getTime()]));
        const diffs: number[] = [];
        for (const inv of invList) {
          if (!inv.billing_request_id) continue;
          const start = reqMap.get(inv.billing_request_id);
          if (!start) continue;
          diffs.push((new Date(inv.created_at).getTime() - start) / (1000 * 60 * 60));
        }
        if (diffs.length > 0) {
          avgHoursToInvoice = Math.round((diffs.reduce((s, d) => s + d, 0) / diffs.length) * 10) / 10;
        }
      }

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const { data: backlogRows } = await supabase
        .from("billing_requests")
        .select("id")
        .eq("status", "pending")
        .lte("created_at", twoDaysAgo);
      const backlogCount = (backlogRows || []).length;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: agedInvs } = await supabase
        .from("invoices")
        .select("total_due, payment_amount")
        .eq("created_by", userId)
        .lte("created_at", thirtyDaysAgo);
      const agedList = agedInvs || [];
      const agedTotal = agedList.reduce((s, i) => s + (Number(i.total_due) || 0), 0);
      const agedPaid = agedList.reduce((s, i) => s + (Number(i.payment_amount) || 0), 0);
      const collectionPct = agedTotal > 0 ? Math.min(100, Math.round((agedPaid / agedTotal) * 100)) : null;

      const invIds = invList.map((i) => i.id);
      let accuracyPct: number | null = null;
      if (invIds.length > 0) {
        const { data: disputes } = await supabase
          .from("invoice_disputes" as any)
          .select("invoice_id")
          .in("invoice_id", invIds);
        const disputedIds = new Set((disputes || []).map((d: any) => d.invoice_id));
        accuracyPct = Math.round(((invIds.length - disputedIds.size) / invIds.length) * 100);
      }

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

      const months = period === "this_month" || period === "last_month" ? 1 : period === "last_3" ? 3 : period === "last_6" ? 6 : 12;
      const effectiveGoal = monthlyInvoiceGoal ? monthlyInvoiceGoal * months : 0;
      const volumePct = effectiveGoal > 0 ? Math.round((invoicesIssued / effectiveGoal) * 100) : null;

      // Target 48h: score 100 at 0h, 0 at 96h
      const ttiScore = avgHoursToInvoice === null ? null : Math.max(0, Math.min(100, Math.round(100 - (avgHoursToInvoice / 96) * 100)));
      // Backlog score: 100 if 0, 0 if 20+
      const backlogScore = Math.max(0, Math.min(100, Math.round(100 - (backlogCount / 20) * 100)));

      const components: { v: number; w: number }[] = [];
      if (ttiScore !== null) components.push({ v: ttiScore, w: 30 });
      if (collectionPct !== null) components.push({ v: collectionPct, w: 25 });
      if (accuracyPct !== null) components.push({ v: accuracyPct, w: 20 });
      components.push({ v: backlogScore, w: 15 });
      components.push({ v: timelogCompletion, w: 10 });
      const totalW = components.reduce((s, c) => s + c.w, 0);
      const efficiency = totalW > 0
        ? Math.round(components.reduce((s, c) => s + c.v * c.w, 0) / totalW)
        : 0;

      return {
        invoicesIssued,
        totalInvoiced,
        avgHoursToInvoice,
        backlogCount,
        collectionPct,
        accuracyPct,
        timelogCompletion,
        volumePct,
        hasGoal: !!monthlyInvoiceGoal,
        efficiency,
      };
    },
  });
}

// Accounting monthly chart: invoices issued by user, by month
function useAccountingChart(userId: string, year: number) {
  return useQuery({
    queryKey: ["user-accounting-chart", userId, year],
    enabled: !!userId,
    queryFn: async () => {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31T23:59:59`;
      const { data: invoices } = await supabase
        .from("invoices")
        .select("total_due, created_at, billing_request_id")
        .eq("created_by", userId)
        .gte("created_at", yearStart)
        .lte("created_at", yearEnd);
      const invList = invoices || [];
      const reqIds = invList.map((i) => i.billing_request_id).filter(Boolean) as string[];
      const reqMap = new Map<string, number>();
      if (reqIds.length > 0) {
        const { data: reqs } = await supabase
          .from("billing_requests")
          .select("id, created_at")
          .in("id", reqIds);
        for (const r of (reqs || [])) reqMap.set((r as any).id, new Date((r as any).created_at).getTime());
      }
      return MONTHS.map((m, idx) => {
        const monthInvs = invList.filter((i) => new Date(i.created_at).getMonth() === idx);
        const billed = monthInvs.reduce((s, i) => s + (Number(i.total_due) || 0), 0);
        const diffs: number[] = [];
        for (const inv of monthInvs) {
          if (!inv.billing_request_id) continue;
          const start = reqMap.get(inv.billing_request_id);
          if (!start) continue;
          diffs.push((new Date(inv.created_at).getTime() - start) / (1000 * 60 * 60));
        }
        const avgHours = diffs.length > 0
          ? Math.round((diffs.reduce((s, d) => s + d, 0) / diffs.length) * 10) / 10
          : null;
        return { month: m, count: monthInvs.length, billed: Math.round(billed), avgHours };
      });
    },
  });
}

function useUserBillingStats(userId: string, period: Period, monthlyGoal: number | null, bonusTiers?: BonusTier[]) {
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

      // 5. Non-Billable COs: sum of |amount| where is_non_billable = true on user's projects
      let nonBillableCOTotal = 0;
      if (projectIds.length > 0) {
        const { data: nbCOs } = await supabase
          .from("change_orders" as any)
          .select("amount")
          .in("project_id", projectIds)
          .eq("is_non_billable", true)
          .gte("created_at", format(range.start, "yyyy-MM-dd"))
          .lte("created_at", format(range.end, "yyyy-MM-dd'T'23:59:59"));
        nonBillableCOTotal = (nbCOs || []).reduce((s: number, co: any) => s + Math.abs(Number(co.amount) || 0), 0);
      }

      // 6. Accuracy: % of services completed on or before due_date
      let accuracyPct: number | null = null;
      if (projectIds.length > 0) {
        const { data: svcData } = await supabase
          .from("services")
          .select("due_date, completed_date")
          .in("project_id", projectIds)
          .eq("assigned_to", userId)
          .not("due_date", "is", null)
          .not("completed_date", "is", null);
        if (svcData && svcData.length > 0) {
          const onTime = svcData.filter((s: any) => s.completed_date <= s.due_date).length;
          accuracyPct = Math.round((onTime / svcData.length) * 100);
        }
      }

      // 7. Non-Billable CO factor: 100 if $0, scale down as amount grows relative to billing
      const coFactor = effectiveGoal > 0
        ? Math.max(0, Math.round(100 - (nonBillableCOTotal / effectiveGoal) * 100))
        : 100;

      // 8. Efficiency: weighted composite
      // Billing 40%, Timelog 30%, Accuracy 23%, Non-billable CO 7%
      // If the user has no real activity in the period, leave it null instead of
      // showing an inflated score from the default 100% CO factor.
      const accuracyForCalc = accuracyPct !== null ? accuracyPct : 0;
      const hasAccuracy = accuracyPct !== null;
      const hasAnyActivity =
        billingPct > 0 ||
        timelogCompletion > 0 ||
        accuracyPct !== null ||
        nonBillableCOTotal > 0;

      const efficiency = !hasAnyActivity
        ? null
        : hasAccuracy
        ? Math.round(billingPct * 0.40 + timelogCompletion * 0.30 + accuracyForCalc * 0.23 + coFactor * 0.07)
        : Math.round(billingPct * 0.53 + timelogCompletion * 0.40 + coFactor * 0.07);


      // 9. Potential Bonus (configurable tier-based on Billing %)
      const tiers = bonusTiers && bonusTiers.length > 0 ? bonusTiers : DEFAULT_BONUS_TIERS;
      let potentialBonus = 0;
      for (const tier of tiers) {
        if (billingPct >= tier.min_pct && billingPct <= tier.max_pct) {
          potentialBonus = tier.amount;
        }
      }

      return {
        totalBilled,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        billableHours: Math.round(billableMinutes / 60 * 10) / 10,
        billingPct,
        timelogCompletion,
        nonBillableCOTotal,
        accuracyPct,
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

/* ─── Review Categories ─── */
const DEFAULT_REVIEW_CATEGORIES = [
  "Technical Knowledge",
  "Quality of Work",
  "Time Management",
  "Communication",
  "Initiative",
  "Teamwork",
];

/* ─── Rating → Default Raise % mapping ─── */
function getDefaultRaisePct(overallRating: number): number {
  if (overallRating >= 90) return 5;
  if (overallRating >= 80) return 3;
  if (overallRating >= 70) return 2;
  if (overallRating >= 60) return 1;
  return 0;
}

/* ─── Add Review Dialog ─── */
function AddReviewDialog({ employeeId, onSuccess }: { employeeId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rating, setRating] = useState("75");
  const [raisePct, setRaisePct] = useState(String(getDefaultRaisePct(75)));
  const [raiseOverridden, setRaiseOverridden] = useState(false);
  const [comments, setComments] = useState("");
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>(
    Object.fromEntries(DEFAULT_REVIEW_CATEGORIES.map((c) => [c, 3]))
  );
  const createReview = useCreateEmployeeReview();
  const { toast } = useToast();

  const handleRatingChange = (val: string) => {
    setRating(val);
    if (!raiseOverridden) {
      setRaisePct(String(getDefaultRaisePct(parseInt(val) || 0)));
    }
  };

  const handleRaisePctChange = (val: string) => {
    setRaisePct(val);
    setRaiseOverridden(true);
  };

  const handleSubmit = async () => {
    try {
      await createReview.mutateAsync({
        employee_id: employeeId,
        review_period: period,
        overall_rating: parseInt(rating),
        category_ratings: categoryRatings,
        comments: comments || undefined,
        raise_pct: parseFloat(raisePct) || 0,
      });
      toast({ title: "Review added" });
      setOpen(false);
      setComments("");
      setRating("75");
      setRaisePct(String(getDefaultRaisePct(75)));
      setRaiseOverridden(false);
      setCategoryRatings(Object.fromEntries(DEFAULT_REVIEW_CATEGORIES.map((c) => [c, 3])));
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Performance Review</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 text-foreground font-medium text-xs">
              <Info className="h-3.5 w-3.5" />
              How to score this review
            </div>
            <p><strong className="text-foreground">Review Period</strong> — the month this review covers (typically the end of the period).</p>
            <p><strong className="text-foreground">Category Ratings (1–5)</strong> — 1 = Needs Improvement, 3 = Meets Expectations, 5 = Exceptional. Score each area independently of overall.</p>
            <p><strong className="text-foreground">Overall Rating (0–100)</strong> — holistic score. The Raise % auto-fills from this (≥90 → 5%, 80–89 → 3%, 70–79 → 2%, &lt;70 → 0%). Override if needed.</p>
            <p><strong className="text-foreground">Comments</strong> — concrete examples and goals for next period. Visible to the employee.</p>
          </div>
          <div>
            <Label>Review Period</Label>
            <Input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>


          <div>
            <Label className="mb-2 block">Category Ratings (1-5)</Label>
            <div className="space-y-2">
              {DEFAULT_REVIEW_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center justify-between gap-4">
                  <span className="text-sm">{cat}</span>
                  <Select
                    value={String(categoryRatings[cat] || 3)}
                    onValueChange={(v) => setCategoryRatings({ ...categoryRatings, [cat]: parseInt(v) })}
                  >
                    <SelectTrigger className="w-[70px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-start">
            <div>
              <Label className="mb-1.5 block">Overall Rating (0-100)</Label>
              <Input type="number" min="0" max="100" value={rating} onChange={(e) => handleRatingChange(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 flex items-center gap-1">
                Raise %
                {raiseOverridden && <Badge variant="secondary" className="text-[9px] px-1 py-0 leading-none">Override</Badge>}
              </Label>
              <Input type="number" min="0" max="20" step="0.5" value={raisePct} onChange={(e) => handleRaisePctChange(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Default: {getDefaultRaisePct(parseInt(rating) || 0)}% for rating {rating}
              </p>
            </div>
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

/* ─── Review Card with Raise % ─── */
function ReviewCard({ review, isMock, isAdmin, employeeId, onUpdate }: {
  review: any; isMock: boolean; isAdmin: boolean; employeeId: string; onUpdate: () => void;
}) {
  const [editingRaise, setEditingRaise] = useState(false);
  const [raiseVal, setRaiseVal] = useState("");
  const updateReview = useUpdateEmployeeReview();
  const { toast } = useToast();

  const reviewerName = review.reviewer?.display_name ||
    [review.reviewer?.first_name, review.reviewer?.last_name].filter(Boolean).join(" ") || "Unknown";
  const cats = review.category_ratings as Record<string, number> | null;
  const currentRaise = review.raise_pct != null ? review.raise_pct : getDefaultRaisePct(review.overall_rating || 0);
  const isOverridden = review.raise_pct != null && review.raise_pct !== getDefaultRaisePct(review.overall_rating || 0);

  const handleSaveRaise = async () => {
    if (isMock) {
      setEditingRaise(false);
      return;
    }
    try {
      await updateReview.mutateAsync({ id: review.id, employeeId, raise_pct: parseFloat(raiseVal) || 0 });
      toast({ title: "Raise updated" });
      setEditingRaise(false);
      onUpdate();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-sm">
              {format(new Date(review.review_period), "MMMM yyyy")}
            </p>
            <p className="text-xs text-muted-foreground">by {reviewerName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={
              (review.overall_rating || 0) >= 80 ? "default" :
                (review.overall_rating || 0) >= 60 ? "secondary" : "destructive"
            }>
              {review.overall_rating}/100
            </Badge>
            {review.previous_rating !== null && review.previous_rating !== undefined && (
              <span className={cn("text-xs",
                (review.overall_rating || 0) > review.previous_rating ? "text-green-600" : "text-red-500"
              )}>
                {(review.overall_rating || 0) > review.previous_rating ? "↑" : "↓"} from {review.previous_rating}
              </span>
            )}
          </div>
        </div>

        {/* Raise % Section */}
        <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border/50">
          <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm font-medium">Raise:</span>
          {editingRaise ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                max="20"
                step="0.5"
                className="h-7 w-[70px] text-xs"
                value={raiseVal}
                onChange={(e) => setRaiseVal(e.target.value)}
                autoFocus
              />
              <span className="text-sm">%</span>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveRaise} disabled={updateReview.isPending}>
                <Save className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingRaise(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <span className="text-sm font-bold text-green-600 tabular-nums">{currentRaise}%</span>
              {isOverridden && <Badge variant="outline" className="text-[9px] px-1 py-0">Overridden</Badge>}
              <span className="text-[10px] text-muted-foreground">
                (default: {getDefaultRaisePct(review.overall_rating || 0)}% for score {review.overall_rating})
              </span>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="h-6 px-1.5 ml-auto" onClick={() => { setRaiseVal(String(currentRaise)); setEditingRaise(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
        </div>

        {cats && Object.keys(cats).length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(cats).map(([category, score]) => (
              <div key={category} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{category}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={cn("h-3 w-3", n <= score ? "fill-primary text-primary" : "text-muted-foreground/30")} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {review.comments && <p className="text-sm mt-3 text-muted-foreground">{review.comments}</p>}
        <p className="text-[10px] text-muted-foreground mt-2">
          {review.created_at ? format(new Date(review.created_at), "MMM d, yyyy") : ""}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Detail View ─── */
function UserDetailView({ user, onBack, onUpdate, isCurrentUser, isViewerAdmin }: {
  user: Profile; onBack: () => void; onUpdate: () => void;
  isCurrentUser: boolean; isViewerAdmin: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
    hourly_rate: "",
    role: (user.role as string) || "pm",
    job_title: profileAny.job_title || "",
    about: profileAny.about || "",
    monthly_goal: profileAny.monthly_goal ? String(profileAny.monthly_goal) : "",
    weekly_goal: profileAny.weekly_goal ? String(profileAny.weekly_goal) : "",
    accuracy_goal: profileAny.accuracy_goal ? String(profileAny.accuracy_goal) : "",
    is_active: user.is_active,
  });

  const monthlyGoal = profileAny.monthly_goal ? Number(profileAny.monthly_goal) : null;

  // Get company settings for configurable bonus tiers
  const { data: companySettings } = useQuery({
    queryKey: ["company-bonus-tiers"],
    queryFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      if (!prof?.company_id) return null;
      const { data } = await supabase.from("companies").select("settings").eq("id", prof.company_id).single();
      return data?.settings as any;
    },
  });
  const bonusTiers: BonusTier[] = companySettings?.bonus_tiers || DEFAULT_BONUS_TIERS;

  const metricKind = getMetricProfile(user.role as string);
  const goalLabel = metricKind === "accounting" ? "Monthly Invoices Goal" : "Monthly Goal ($)";

  // Hourly rate lives in employee_compensation now. RLS allows self or comp admin
  // to see this; others get null.
  const { data: userHourlyRate } = useQuery({
    queryKey: ["employee-comp-hourly-rate", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_compensation")
        .select("hourly_rate")
        .eq("person_id", user.id)
        .maybeSingle();
      return data?.hourly_rate ?? null;
    },
  });

  // Sync into edit form when rate loads / user switches.
  useEffect(() => {
    setEditForm((f) => ({ ...f, hourly_rate: userHourlyRate != null ? String(userHourlyRate) : "" }));
  }, [userHourlyRate, user.id]);

  const { data: stats, isLoading: statsLoading } = useUserBillingStats(user.id, period, monthlyGoal, bonusTiers);
  const { data: acctStats, isLoading: acctStatsLoading } = useAccountingStats(user.id, period, metricKind === "accounting" ? monthlyGoal : null);
  const { data: proposals = [], isLoading: proposalsLoading } = useUserProposals(user.id);
  const { data: projects = [], isLoading: projectsLoading } = useUserProjects(user.id);
  const { data: empReviews = [], isLoading: reviewsLoading, refetch: refetchReviews } = useEmployeeReviews(user.id);
  const { data: chartData, isLoading: chartLoading } = useUserBillingChart(user.id, chartYear, monthlyGoal);
  const { data: acctChart, isLoading: acctChartLoading } = useAccountingChart(user.id, chartYear);

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
          monthly_goal: editForm.monthly_goal ? parseFloat(editForm.monthly_goal) : null,
          weekly_goal: editForm.weekly_goal ? parseFloat(editForm.weekly_goal) : null,
          accuracy_goal: editForm.accuracy_goal ? parseFloat(editForm.accuracy_goal) : null,
          is_active: editForm.is_active,
        } as any)
        .eq("id", user.id);
      if (error) throw error;

      // Role mirroring into user_roles is handled by the trg_sync_profile_role
      // database trigger (covers all roles: admin, manager, pm, production, accounting).

      await queryClient.invalidateQueries({ queryKey: ["user-billing-stats-v2"] });
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
                {profileAny.ooo_from && profileAny.ooo_to && new Date(profileAny.ooo_to + "T23:59:59") >= new Date() && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-300">
                      OOO {format(new Date(profileAny.ooo_from + "T00:00:00"), "MMM d")} – {format(new Date(profileAny.ooo_to + "T00:00:00"), "MMM d")}
                    </Badge>
                  </div>
                )}
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
                      <span>{metricKind === "accounting" ? `Goal: ${monthlyGoal} invoices/mo` : `Goal: $${monthlyGoal.toLocaleString()}/mo`}</span>
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{goalLabel}</Label>
                    <Input className="h-8 text-xs" type="number" placeholder={metricKind === "accounting" ? "40" : "33000"} value={editForm.monthly_goal} onChange={(e) => setEditForm({ ...editForm, monthly_goal: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Weekly Goal ($)</Label>
                    <Input className="h-8 text-xs" type="number" placeholder={editForm.monthly_goal ? String(Math.round(Number(editForm.monthly_goal) / 4.33)) : "7500"} value={editForm.weekly_goal} onChange={(e) => setEditForm({ ...editForm, weekly_goal: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Accuracy Goal (%)</Label>
                    <Input className="h-8 text-xs" type="number" placeholder="90" min="0" max="100" value={editForm.accuracy_goal} onChange={(e) => setEditForm({ ...editForm, accuracy_goal: e.target.value })} />
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
              {(metricKind === "accounting" ? acctStatsLoading : statsLoading) ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : metricKind === "accounting" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard
                    icon={FileText}
                    label="Invoices Issued"
                    value={acctStats?.invoicesIssued ?? 0}
                    suffix={acctStats?.hasGoal && acctStats?.volumePct !== null ? ` / ${acctStats.volumePct}%` : ""}
                    tooltip="Count of invoices this user created in the selected period. Goal % is vs. Monthly Invoices Goal × number of months."
                  />
                  <StatCard
                    icon={DollarSign}
                    label="$ Invoiced"
                    value={`$${(acctStats?.totalInvoiced || 0).toLocaleString()}`}
                    tooltip="Total amount on invoices this user created in the selected period."
                  />
                  <StatCard
                    icon={Clock}
                    label="Avg Time to Invoice"
                    value={acctStats?.avgHoursToInvoice === null || acctStats?.avgHoursToInvoice === undefined ? "—" : acctStats.avgHoursToInvoice}
                    suffix={acctStats?.avgHoursToInvoice !== null && acctStats?.avgHoursToInvoice !== undefined ? "h" : ""}
                    tooltip="Average hours between a PM submitting a billing request and this user issuing the invoice. Target: ≤48h."
                  />
                  <StatCard
                    icon={AlertCircle}
                    label="Backlog"
                    value={acctStats?.backlogCount ?? 0}
                    tooltip="Live count of pending billing requests older than 2 days across the company. Not period-bound."
                  />
                  <StatCard
                    icon={Target}
                    label="Collection Rate"
                    value={acctStats?.collectionPct === null || acctStats?.collectionPct === undefined ? "—" : acctStats.collectionPct}
                    suffix={acctStats?.collectionPct !== null && acctStats?.collectionPct !== undefined ? "%" : ""}
                    tooltip="$ paid ÷ $ invoiced for invoices this user issued that are 30+ days old."
                  />
                  <StatCard
                    icon={CheckCircle}
                    label="Timelog Completion"
                    value={acctStats?.timelogCompletion ?? 0}
                    suffix="%"
                    tooltip="Days with time entries ÷ Days clocked in."
                  />
                  <StatCard
                    icon={BarChart3}
                    label="Invoice Accuracy"
                    value={acctStats?.accuracyPct === null || acctStats?.accuracyPct === undefined ? "—" : acctStats.accuracyPct}
                    suffix={acctStats?.accuracyPct !== null && acctStats?.accuracyPct !== undefined ? "%" : ""}
                    tooltip="% of invoices this user issued that did NOT receive a dispute."
                  />
                  <StatCard
                    icon={Zap}
                    label="Accounting Efficiency"
                    value={acctStats?.efficiency ?? 0}
                    suffix="%"
                    tooltip="Weighted composite: Time-to-Invoice 30% + Collection 25% + Accuracy 20% + Backlog cleared 15% + Timelog 10%. Components with no data are skipped and remaining weights re-normalize."
                  />
                </div>
              ) : metricKind === "generic" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard
                    icon={CheckCircle}
                    label="Timelog Completion"
                    value={stats?.timelogCompletion ?? 0}
                    suffix="%"
                    tooltip="Days with time entries ÷ Days clocked in."
                  />
                  <StatCard
                    icon={BarChart3}
                    label="Accuracy"
                    value={stats?.accuracyPct === null || stats?.accuracyPct === undefined ? "—" : stats.accuracyPct}
                    suffix={stats?.accuracyPct !== null && stats?.accuracyPct !== undefined ? "%" : ""}
                    tooltip="% of assigned services completed on or before their estimated completion date."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard
                    icon={Target}
                    label="Billing %"
                    value={stats?.hasGoal ? stats.billingPct : "—"}
                    suffix={stats?.hasGoal ? "%" : ""}
                    tooltip="Total invoiced on projects where this user is PM or Senior PM ÷ Monthly Goal (× number of months). Counts invoices regardless of who created them."
                  />
                  <StatCard
                    icon={AlertCircle}
                    label="Non-Billable COs"
                    value={`$${(stats?.nonBillableCOTotal || 0).toLocaleString()}`}
                    tooltip="Sum of change orders marked as non-billable (internal mistakes) on this user's projects during the selected period. Counts COs on projects regardless of who logged them."
                  />
                  <StatCard
                    icon={CheckCircle}
                    label="Timelog Completion"
                    value={stats?.timelogCompletion ?? 0}
                    suffix="%"
                    tooltip="Days with time entries ÷ Days clocked in."
                  />
                  <StatCard
                    icon={BarChart3}
                    label="Accuracy"
                    value={stats?.accuracyPct === null || stats?.accuracyPct === undefined ? "—" : stats.accuracyPct}
                    suffix={stats?.accuracyPct !== null && stats?.accuracyPct !== undefined ? "%" : ""}
                    tooltip="% of assigned services completed on or before their estimated completion date."
                  />
                  <StatCard
                    icon={Zap}
                    label="Efficiency Rating"
                    value={stats?.efficiency === null || stats?.efficiency === undefined ? "—" : stats.efficiency}
                    suffix={stats?.efficiency === null || stats?.efficiency === undefined ? "" : "%"}
                    tooltip="Weighted composite: Billing % × 40% + Timelog × 30% + Accuracy × 23% + Non-Billable CO factor × 7%. When Accuracy has no data, weights redistribute to Billing 53% + Timelog 40% + CO 7%. Shown as — when there's no activity in the period."
                  />
                  <StatCard
                    icon={Award}
                    label="Potential Bonus"
                    value={`$${stats?.potentialBonus || 0}`}
                    tooltip="Based on Billing % tiers: 100–110% → $250, 111–125% → $500, 126%+ → $1,000."
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
                    {metricKind === "accounting" ? "Billing Activity" : "Billing"}
                  </TabsTrigger>
                  {metricKind !== "accounting" && (
                    <>
                      <TabsTrigger value="proposals" className="gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Proposals ({totalProposals})
                      </TabsTrigger>
                      <TabsTrigger value="projects" className="gap-1">
                        <FolderKanban className="h-3.5 w-3.5" />
                        Projects ({projects.length})
                      </TabsTrigger>
                    </>
                  )}
                  <TabsTrigger value="reviews" className="gap-1">
                    <Star className="h-3.5 w-3.5" />
                    Reviews ({empReviews.length})
                  </TabsTrigger>
                </TabsList>


                {/* Billing Tab */}
                <TabsContent value="billing" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{metricKind === "accounting" ? "Billing Activity" : "Monthly Billing"}</h4>
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

                  {metricKind === "accounting" ? (
                    acctChartLoading ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : !acctChart || acctChart.every((d) => d.count === 0) ? (
                      <Card className="border-dashed">
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                          No invoices issued by this user in {chartYear}.
                          <p className="text-xs mt-1">Invoices generated from billing requests will appear here.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        <div className="h-[280px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={acctChart}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                              <YAxis yAxisId="left" className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                              <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                              <RechartsTooltip
                                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Bar yAxisId="left" dataKey="billed" fill="hsl(var(--primary))" name="$ Invoiced" radius={[4, 4, 0, 0]} />
                              <Line yAxisId="right" type="monotone" dataKey="count" stroke="hsl(142 71% 45%)" name="Invoices" strokeWidth={2} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Month</TableHead>
                              <TableHead className="text-right">Invoices</TableHead>
                              <TableHead className="text-right">$ Invoiced</TableHead>
                              <TableHead className="text-right">Avg Time to Invoice</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {acctChart.map((d) => (
                              <TableRow key={d.month}>
                                <TableCell className="text-sm">{d.month}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm">{d.count}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm">${d.billed.toLocaleString()}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm">{d.avgHours === null ? "—" : `${d.avgHours}h`}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>
                    )
                  ) : chartLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : !chartData || !chartData.some((d) => d.billed > 0 || d.estimated > 0) ? (
                    <Card className="border-dashed">
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        No billing recorded for {chartYear}.
                        <p className="text-xs mt-1">Invoices on projects where this user is PM or Senior PM will appear here.</p>
                      </CardContent>
                    </Card>
                  ) : (
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
                            <Bar dataKey="estimated" fill="hsl(142 71% 45%)" name="Estimated" radius={[4, 4, 0, 0]} opacity={0.6} />
                            <Line type="monotone" dataKey="goal" stroke="hsl(0 84% 60%)" strokeDasharray="8 4" name="Monthly Goal" dot={false} strokeWidth={3} />
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
                  )}
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
                            <TableCell className="text-sm">{p.title || "—"}</TableCell>
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
                    <Card className="border-dashed">
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        No performance reviews yet.
                        {isViewerAdmin && <p className="text-xs mt-1">Add the first review using the button above.</p>}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {empReviews.map((r: any) => (
                        <ReviewCard
                          key={r.id}
                          review={r}
                          isMock={false}
                          isAdmin={isViewerAdmin}
                          employeeId={user.id}
                          onUpdate={() => refetchReviews()}
                        />
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
  const { user, profile: currentProfile } = useAuth();
  const isAdmin = useIsAdmin();

  // Get current user's profile id
  const currentProfileId = profiles.find((p) => p.user_id === user?.id)?.id;

  // Last sign-in lookup (admin-only RPC)
  const { data: lastSignIns = [] } = useQuery({
    queryKey: ["team-last-signins", currentProfile?.company_id],
    enabled: !!currentProfile?.company_id && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_last_signins", {
        target_company_id: currentProfile!.company_id,
      });
      if (error) throw error;
      return (data || []) as Array<{ user_id: string; last_sign_in_at: string | null }>;
    },
  });
  const lastSignInMap = new Map(lastSignIns.map((r) => [r.user_id, r.last_sign_in_at]));

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
        onUpdate={async () => { await refetch(); setSelectedUser(null); }}
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

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
            <span className="text-muted-foreground font-normal text-sm">({filteredProfiles.length})</span>
          </CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search team members..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {isAdmin && <InviteMemberDialog />}
          </div>
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
                  {isAdmin && <TableHead>Last sign-in</TableHead>}
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{getDisplayName(profile)}</span>
                              {(profile as any).ooo_from && (profile as any).ooo_to && 
                                new Date((profile as any).ooo_to + "T23:59:59") >= new Date() && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border-amber-300">
                                  OOO
                                </Badge>
                              )}
                            </div>
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
                      {isAdmin && (
                        <TableCell className="text-muted-foreground text-sm">
                          {(() => {
                            const ts = lastSignInMap.get(profile.user_id);
                            return ts ? format(new Date(ts), "MMM d, h:mm a") : "—";
                          })()}
                        </TableCell>
                      )}
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
