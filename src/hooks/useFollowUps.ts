import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface FollowUpLead {
  id: string;
  full_name: string;
  company: string | null;
  stage: string | null;
  next_follow_up_at: string;
  follow_up_note: string | null;
  assigned_to: string | null;
}

// Leads with a personal follow-up scheduled — the "who do I owe a touch" list.
export function useFollowUps() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-follow-ups"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("leads") as any)
        .select("id, full_name, company, stage, next_follow_up_at, follow_up_note, assigned_to")
        .not("next_follow_up_at", "is", null)
        .order("next_follow_up_at", { ascending: true });
      if (error) throw error;
      return (data || []) as FollowUpLead[];
    },
  });
}

// Set / reschedule / clear a lead's next follow-up. logTouch records a NOTE on the
// lead's activity thread so the personal outreach is captured.
export function useSetFollowUp() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      leadId: string;
      next_follow_up_at: string | null;
      note?: string | null;
      logTouch?: boolean;
    }) => {
      const update: Record<string, any> = { next_follow_up_at: input.next_follow_up_at };
      if (input.note !== undefined) update.follow_up_note = input.note;
      const { error } = await supabase.from("leads").update(update as any).eq("id", input.leadId);
      if (error) throw error;

      if (input.logTouch && profile?.company_id) {
        await supabase.from("bd_activities").insert({
          company_id: profile.company_id,
          lead_id: input.leadId,
          type: "NOTE",
          content: input.next_follow_up_at
            ? `Followed up — next touch ${input.next_follow_up_at}`
            : "Followed up — cadence cleared",
          created_by: profile.id,
        } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bd-follow-ups"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
