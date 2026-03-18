import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio, Gift, DollarSign, Users, AlertTriangle } from "lucide-react";
import { SignalStatusBadge } from "@/components/properties/SignalStatusBadge";
import { format, differenceInDays, parseISO } from "date-fns";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface SubscriptionRow {
  id: string;
  property_id: string;
  status: string;
  subscribed_at: string | null;
  expires_at: string | null;
  is_complimentary: boolean;
  monthly_rate: number | null;
  billing_start_date: string | null;
  comp_reason: string | null;
  enrolled_by: string | null;
  linked_project_id: string | null;
  created_at: string;
  owner_email: string | null;
  // joined
  property_address?: string;
  enrolled_by_name?: string;
  project_name?: string;
}

function useSignalReport() {
  return useQuery({
    queryKey: ["signal-subscriptions-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_subscriptions")
        .select("*, properties(address), profiles!signal_subscriptions_enrolled_by_fkey(display_name), projects(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        property_address: row.properties?.address || "—",
        enrolled_by_name: row.profiles?.display_name || "—",
        project_name: row.projects?.name || null,
      })) as SubscriptionRow[];
    },
  });
}

export default function SignalReports() {
  const { data: subscriptions = [], isLoading } = useSignalReport();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = subscriptions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.property_address?.toLowerCase().includes(q) ||
        s.enrolled_by_name?.toLowerCase().includes(q) ||
        s.owner_email?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const active = subscriptions.filter((s) => s.status === "active");
  const complimentary = active.filter((s) => s.is_complimentary);
  const paid = active.filter((s) => !s.is_complimentary);
  const totalMonthlyRevenue = paid.reduce((sum, s) => sum + (Number(s.monthly_rate) || 0), 0);
  const expiringSoon = subscriptions.filter((s) => {
    if (!s.expires_at || s.status === "expired") return false;
    return differenceInDays(parseISO(s.expires_at), new Date()) <= 30;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Radio className="h-4 w-4" /> Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{active.length}</div>
            <p className="text-xs text-muted-foreground">{paid.length} paid · {complimentary.length} comp</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" /> Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMonthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">From {paid.length} paid subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Total Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
            <p className="text-xs text-muted-foreground">All statuses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringSoon.length}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by address, name, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Monthly Rate</TableHead>
              <TableHead>Enrolled By</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Linked Project</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No subscriptions found</TableCell>
              </TableRow>
            ) : (
              filtered.map((sub) => {
                const daysUntilExpiry = sub.expires_at ? differenceInDays(parseISO(sub.expires_at), new Date()) : null;
                return (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium max-w-[220px] truncate">{sub.property_address}</TableCell>
                    <TableCell>
                      <SignalStatusBadge status={sub.status} isComplimentary={sub.is_complimentary} />
                    </TableCell>
                    <TableCell>
                      {sub.is_complimentary ? (
                        <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-600 border-purple-500/20">
                          <Gift className="h-3 w-3" /> Comp
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          <DollarSign className="h-3 w-3" /> Paid
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {sub.is_complimentary ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : (
                        <span className="font-medium">${Number(sub.monthly_rate || 0).toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{sub.enrolled_by_name}</TableCell>
                    <TableCell className="text-sm">
                      {sub.subscribed_at ? format(parseISO(sub.subscribed_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sub.expires_at ? (
                        <span className={daysUntilExpiry !== null && daysUntilExpiry <= 30 ? "text-destructive font-medium" : ""}>
                          {format(parseISO(sub.expires_at), "MMM d, yyyy")}
                          {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
                            <span className="text-xs ml-1">({daysUntilExpiry}d)</span>
                          )}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[180px] truncate">
                      {sub.project_name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
