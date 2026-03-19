import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientStats {
  totalProposals: number;
  acceptedProposals: number;
  rejectedProposals: number;
  winRate: number;
  totalRevenue: number;
  activeProjects: number;
  lastActivity: string | null;
  referralCount: number;
  referralValue: number;
  referralConverted: number;
}

export function useClientRelations(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-relations", clientId],
    queryFn: async () => {
      if (!clientId) return { projects: [], proposals: [], stats: null as ClientStats | null };

      const clientName = await supabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();

      const [projectsRes, proposalsRes, referralsRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, project_number, status, created_at, properties(address)")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("proposals")
          .select("id, title, proposal_number, status, total_amount, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        // Proposals referred BY this client's name
        clientName.data?.name
          ? supabase
              .from("proposals")
              .select("id, status, total_amount")
              .eq("referred_by", clientName.data.name)
          : Promise.resolve({ data: [] }),
      ]);

      const projects = projectsRes.data || [];
      const proposals = proposalsRes.data || [];
      const referrals = referralsRes.data || [];

      const acceptedProposals = proposals.filter((p) => p.status === "executed").length;
      const rejectedProposals = proposals.filter((p) => p.status === "rejected").length;
      const decidedProposals = acceptedProposals + rejectedProposals;
      const totalRevenue = proposals
        .filter((p) => p.status === "executed")
        .reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const activeProjects = projects.filter((p) => p.status === "open").length;

      const dates = [
        ...projects.map((p) => p.created_at),
        ...proposals.map((p) => p.created_at),
      ].filter(Boolean) as string[];
      const lastActivity = dates.length ? dates.sort((a, b) => b.localeCompare(a))[0] : null;

      const referralCount = referrals.length;
      const referralConverted = referrals.filter((r: any) => r.status === "executed").length;
      const referralValue = referrals
        .filter((r: any) => r.status === "executed")
        .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);

      const stats: ClientStats = {
        totalProposals: proposals.length,
        acceptedProposals,
        rejectedProposals,
        winRate: decidedProposals > 0 ? Math.round((acceptedProposals / decidedProposals) * 100) : 0,
        totalRevenue,
        activeProjects,
        lastActivity,
        referralCount,
        referralValue,
        referralConverted,
      };

      return { projects, proposals, stats };
    },
    enabled: !!clientId,
  });
}

export const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  on_hold: "secondary",
  closed: "outline",
  paid: "default",
  draft: "secondary",
  sent: "default",
  executed: "default",
  viewed: "secondary",
  lost: "destructive",
  rejected: "destructive",
  expired: "outline",
};

export const formatCurrency = (value: number | null) => {
  if (!value) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
};
