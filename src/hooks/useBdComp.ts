import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface BdCompPlan {
  id: string;
  company_id: string;
  person_id: string;
  base_salary: number;
  event_bonus_amount: number;
  new_client_bonus_amount: number;
  small_contract_pct: number;
  small_contract_threshold: number;
  revenue_bonus_pct: number;
  revenue_window_months: number;
  active: boolean;
}

export interface BdBonusLedgerEntry {
  id: string;
  company_id: string;
  person_id: string;
  type: "EVENT" | "NEW_CLIENT" | "REVENUE";
  source_ref: Record<string, any>;
  amount: number;
  status: "ACCRUED" | "APPROVED" | "PAID";
  accrued_at: string;
  paid_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
}

/** True if the current user can see the page (self always; comp-admin sees everyone). */
export function useIsCompAdmin() {
  const { profile } = useAuth();
  return !!(profile as any)?.is_comp_admin;
}

export function useBdCompPlans() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-comp-plans", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_comp_plans" as any)
        .select("*")
        .eq("company_id", profile!.company_id);
      if (error) throw error;
      return (data as unknown as BdCompPlan[]) ?? [];
    },
  });
}

export function useBdCompPlanFor(personId: string | undefined) {
  const { data } = useBdCompPlans();
  return data?.find((p) => p.person_id === personId) ?? null;
}

export function useBdBonusLedger(personId?: string) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-bonus-ledger", profile?.company_id, personId ?? "all"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      let q = supabase
        .from("bd_bonus_ledger" as any)
        .select("*")
        .eq("company_id", profile!.company_id)
        .order("accrued_at", { ascending: false });
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as BdBonusLedgerEntry[]) ?? [];
    },
  });
}

export function useUpdateBonusEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BdBonusLedgerEntry> & { id: string }) => {
      const { error } = await supabase.from("bd_bonus_ledger" as any).update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-bonus-ledger"] }),
  });
}

export function useUpsertCompPlan() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BdCompPlan> & { person_id: string }) => {
      const { error } = await supabase
        .from("bd_comp_plans" as any)
        .upsert({ ...input, company_id: profile!.company_id } as any, { onConflict: "company_id,person_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-comp-plans"] }),
  });
}

/** Mark intro sent on a lead — sets intro_sent_at and bumps NEW → CONTACTED. */
export function useMarkIntroSent() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ leadId, currentStage }: { leadId: string; currentStage: string | null }) => {
      const updates: any = {
        intro_sent_at: new Date().toISOString(),
        updated_by: profile?.id ?? null,
      };
      if (currentStage === "NEW") updates.stage = "CONTACTED";
      const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", v.leadId] });
    },
  });
}

/** Per-person scorecard metrics. */
export function useBdScorecard(personId: string | undefined, sinceDays = 90) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-scorecard", profile?.company_id, personId, sinceDays],
    enabled: !!profile?.company_id && !!personId,
    queryFn: async () => {
      const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
      const [attendR, leadsR] = await Promise.all([
        supabase.from("bd_event_attendees" as any)
          .select("event_id, user_id", { count: "exact", head: true })
          .eq("user_id", personId!),
        supabase.from("leads")
          .select("id, stage, expected_value, intro_sent_at, created_at, proposal_id, bd_sourced, event_id, assigned_to, created_by")
          .eq("company_id", profile!.company_id)
          .or(`assigned_to.eq.${personId},created_by.eq.${personId}`)
          .gte("created_at", since)
          .is("deleted_at", null),
      ]);
      if (leadsR.error) throw leadsR.error;
      const leads = leadsR.data ?? [];

      const byStage: Record<string, number> = {};
      let pipeline = 0;
      let touchSumMs = 0;
      let touchN = 0;
      let qualified = 0;
      let won = 0;
      for (const l of leads) {
        const s = l.stage ?? "NEW";
        byStage[s] = (byStage[s] ?? 0) + 1;
        if (["NEW", "CONTACTED", "QUALIFIED"].includes(s)) {
          pipeline += Number(l.expected_value ?? 0);
        }
        if (l.intro_sent_at && l.created_at) {
          touchSumMs += new Date(l.intro_sent_at).getTime() - new Date(l.created_at).getTime();
          touchN += 1;
        }
        if (s === "QUALIFIED" || s === "WON") qualified += 1;
        if (s === "WON") won += 1;
      }

      return {
        eventsAttended: attendR.count ?? 0,
        contactsCaptured: leads.length,
        avgSpeedToTouchHrs: touchN ? touchSumMs / touchN / 3600_000 : null,
        byStage,
        pipelineValue: pipeline,
        scans: leads.length,
        qualified,
        won,
        qualifyRate: leads.length ? qualified / leads.length : 0,
        winRate: leads.length ? won / leads.length : 0,
      };
    },
  });
}

/** BD-sourced summary used by reports + briefing. */
export function useBdSourcedSummary(sinceDays = 90) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-sourced-summary", profile?.company_id, sinceDays],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
      const { data: leads, error } = await supabase
        .from("leads")
        .select("id, stage, proposal_id, expected_value, created_at, bd_sourced")
        .eq("company_id", profile!.company_id)
        .eq("bd_sourced", true)
        .gte("created_at", since)
        .is("deleted_at", null);
      if (error) throw error;
      const list = leads ?? [];
      const count = list.length;
      const qualified = list.filter((l) => l.stage === "QUALIFIED" || l.stage === "WON").length;
      const propIds = list.map((l) => l.proposal_id).filter(Boolean) as string[];
      let activeProposalValue = 0;
      if (propIds.length) {
        const { data: props } = await supabase
          .from("proposals")
          .select("id, total_amount, subtotal, status")
          .in("id", propIds);
        for (const p of props ?? []) {
          if (["sent", "viewed", "executed"].includes(String(p.status))) {
            activeProposalValue += Number(p.total_amount ?? p.subtotal ?? 0);
          }
        }
      }
      return {
        count,
        qualified,
        conversionPct: count ? Math.round((qualified / count) * 100) : 0,
        activeProposalValue,
      };
    },
  });
}

/** Open follow-ups (next_follow_up_at <= today) for current user. */
export function useMyOpenFollowUps() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["my-open-followups", profile?.id],
    enabled: !!profile?.id && !!profile?.company_id,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, company, next_follow_up_at, follow_up_note")
        .eq("company_id", profile!.company_id)
        .or(`assigned_to.eq.${profile!.id},created_by.eq.${profile!.id}`)
        .not("next_follow_up_at", "is", null)
        .lte("next_follow_up_at", today)
        .is("deleted_at", null)
        .order("next_follow_up_at", { ascending: true })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Eligible events list (for Settings + EventPrep). */
export function useBdEligibleEvents() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-eligible-events", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_eligible_events" as any)
        .select("*")
        .eq("company_id", profile!.company_id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertBdEligibleEvent() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; organization?: string; cadence?: string; active?: boolean }) => {
      const payload: any = { ...input, company_id: profile!.company_id };
      if (input.id) {
        const { error } = await supabase.from("bd_eligible_events" as any).update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bd_eligible_events" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-eligible-events"] }),
  });
}

export function useDeleteBdEligibleEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bd_eligible_events" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-eligible-events"] }),
  });
}
