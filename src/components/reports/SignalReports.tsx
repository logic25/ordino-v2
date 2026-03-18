import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { differenceInDays, parseISO } from "date-fns";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SignalKPICards } from "./signal/SignalKPICards";
import { SignalSubscriptionRow } from "./signal/SignalSubscriptionRow";

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
  const paid = active.filter((s) => !s.is_complimentary && Number(s.monthly_rate) > 0);
  const unset = active.filter((s) => !s.is_complimentary && !Number(s.monthly_rate));
  const totalMonthlyRevenue = paid.reduce((sum, s) => sum + (Number(s.monthly_rate) || 0), 0);
  const expiringSoon = subscriptions.filter((s) => {
    if (!s.expires_at || s.status === "expired") return false;
    return differenceInDays(parseISO(s.expires_at), new Date()) <= 30;
  });

  return (
    <div className="space-y-6">
      <SignalKPICards
        activeCount={active.length}
        paidCount={paid.length}
        compCount={complimentary.length}
        unsetCount={unset.length}
        totalMonthlyRevenue={totalMonthlyRevenue}
        totalCount={subscriptions.length}
        expiringSoonCount={expiringSoon.length}
      />

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
              filtered.map((sub) => <SignalSubscriptionRow key={sub.id} sub={sub} />)
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
