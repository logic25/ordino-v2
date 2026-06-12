import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

export type LeadStage = Database["public"]["Enums"]["bd_lead_stage"];
export type LeadSourceType = Database["public"]["Enums"]["bd_lead_source_type"];
export type LeadTimeline = Database["public"]["Enums"]["bd_lead_timeline"];

// Human label for a source_type, used in SYSTEM activity content + the grid.
export const SOURCE_LABELS: Record<LeadSourceType, string> = {
  EVENT: "an event",
  REFERRAL: "a referral",
  PHONE: "a phone call",
  EMAIL: "email",
  WEBSITE: "the website",
  GOOGLE: "Google",
  COLD: "a cold outreach",
  OTHER: "other",
};

export interface Lead {
  id: string;
  company_id: string;
  full_name: string;
  company: string | null;
  role: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  property_address: string | null;
  subject: string | null;
  client_type: string | null;
  source: string;
  source_type: LeadSourceType | null;
  stage: LeadStage | null;
  status: string;
  notes: string | null;
  referred_by: string | null;
  referred_by_contact_id: string | null;
  event_id: string | null;
  hot_opportunity: boolean;
  expected_value: number | null;
  next_follow_up_at: string | null;
  follow_up_note: string | null;
  project_timeline: LeadTimeline | null;
  assigned_to: string | null;
  proposal_id: string | null;
  client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Party blocks
  architect_name: string | null;
  architect_company: string | null;
  architect_phone: string | null;
  architect_email: string | null;
  architect_license_type: string | null;
  architect_license_number: string | null;
  gc_name: string | null;
  gc_company: string | null;
  gc_phone: string | null;
  gc_email: string | null;
  sia_name: string | null;
  sia_company: string | null;
  sia_phone: string | null;
  sia_email: string | null;
  tpp_name: string | null;
  tpp_email: string | null;
  // Joined
  assignee?: { id: string; first_name: string | null; last_name: string | null } | null;
  creator?: { id: string; first_name: string | null; last_name: string | null } | null;
  event?: { id: string; name: string; start_date: string | null } | null;
  referrer?: { id: string; name: string } | null;
}

const LEAD_SELECT =
  "*, assignee:profiles!leads_assigned_to_fkey(id, first_name, last_name), " +
  "creator:profiles!leads_created_by_fkey(id, first_name, last_name), " +
  "event:bd_events!leads_event_id_fkey(id, name, start_date), " +
  "referrer:client_contacts!leads_referred_by_contact_id_fkey(id, name)";

export function useLeads() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["leads"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(LEAD_SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Lead[];
    },
  });
}

export function useLead(id: string | undefined) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["lead", id],
    enabled: !!id && !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(LEAD_SELECT)
        .eq("id", id as string)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Lead) ?? null;
    },
  });
}

export interface CreateLeadInput {
  full_name: string;
  source_type?: LeadSourceType;
  source?: string; // legacy; derived from source_type when omitted
  company?: string | null;
  role?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  property_address?: string | null;
  subject?: string | null;
  client_type?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  event_id?: string | null;
  referred_by?: string | null;
  referred_by_contact_id?: string | null;
  hot_opportunity?: boolean;
  expected_value?: number | null;
  project_timeline?: LeadTimeline | null;
  // Party blocks
  architect_name?: string | null;
  architect_company?: string | null;
  architect_phone?: string | null;
  architect_email?: string | null;
  architect_license_type?: string | null;
  architect_license_number?: string | null;
  gc_name?: string | null;
  gc_company?: string | null;
  gc_phone?: string | null;
  gc_email?: string | null;
  sia_name?: string | null;
  sia_company?: string | null;
  sia_phone?: string | null;
  sia_email?: string | null;
  tpp_name?: string | null;
  tpp_email?: string | null;
}

/**
 * Create a lead with the dual-write pattern (legacy + new columns), then seed the
 * activity thread: a SYSTEM row always, and a NOTE row when notes were provided.
 */
export function useCreateLead() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      if (!profile?.company_id) throw new Error("No company");

      const { notes, source_type, source, ...rest } = input;
      // Derive the missing half of the legacy/new source pair.
      const resolvedSourceType: LeadSourceType =
        source_type ?? (source ? (source.toUpperCase() as LeadSourceType) : "OTHER");
      const resolvedSource = source ?? resolvedSourceType.toLowerCase();

      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          ...rest,
          company_id: profile.company_id,
          created_by: profile.id,
          source: resolvedSource,
          source_type: resolvedSourceType,
          status: "new",
          stage: "NEW",
          notes: notes ?? null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      const leadId = (lead as { id: string }).id;
      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "a teammate";

      // Activity seed rows (fire sequentially; failures here shouldn't block lead creation).
      const rows: any[] = [
        {
          company_id: profile.company_id,
          lead_id: leadId,
          type: "SYSTEM",
          content: `Lead created by ${fullName} from ${SOURCE_LABELS[resolvedSourceType]}`,
          created_by: profile.id,
        },
      ];
      if (notes && notes.trim()) {
        rows.push({
          company_id: profile.company_id,
          lead_id: leadId,
          type: "NOTE",
          content: notes.trim(),
          created_by: profile.id,
        });
      }
      await supabase.from("bd_activities").insert(rows as any);

      return leadId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export interface UpdateLeadInput {
  id: string;
  // Any updatable lead column. updated_by is stamped automatically.
  [key: string]: any;
}

/** Update a lead and stamp updated_by so the stage-change trigger attributes correctly. */
export function useUpdateLead() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateLeadInput) => {
      const { id, ...updates } = input;
      const { error } = await supabase
        .from("leads")
        .update({ ...updates, updated_by: profile?.id ?? null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", v.id] });
      qc.invalidateQueries({ queryKey: ["lead-activities", v.id] });
    },
  });
}

/** Soft delete: set deleted_at instead of issuing a DELETE. */
export function useDeleteLead() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string | string[]) => {
      const idList = Array.isArray(ids) ? ids : [ids];
      const { error } = await supabase
        .from("leads")
        .update({ deleted_at: new Date().toISOString(), updated_by: profile?.id ?? null } as any)
        .in("id", idList);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

/** Bulk owner / stage updates for the grid's bulk actions. */
export function useBulkUpdateLeads() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("leads")
        .update({ ...updates, updated_by: profile?.id ?? null } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}
