import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

export type EventStatus = Database["public"]["Enums"]["bd_event_status"];
export type EventPriority = Database["public"]["Enums"]["bd_event_priority"];
export type CheckFrequency = Database["public"]["Enums"]["bd_check_frequency"];
export type SourcePriority = Database["public"]["Enums"]["bd_source_priority"];
export type PriceVerified = Database["public"]["Enums"]["bd_price_verified"];
export type MembershipStatus = Database["public"]["Enums"]["bd_membership_status"];

export interface BdEvent {
  id: string;
  company_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  source_url: string | null;
  category: string | null;
  priority: EventPriority | null;
  status: EventStatus;
  cost_low: number | null;
  cost_high: number | null;
  cost_member: number | null;
  cost_nonmember: number | null;
  cost_actual: number | null;
  included_in_membership: boolean;
  membership_id: string | null;
  price_verified: PriceVerified | null;
  proposed_by: string | null;
  paid_by_user_id: string | null;
  next_action: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  attendee_count?: number;
  lead_count?: number;
  pipeline_generated?: number;
  membership?: { id: string; organization: string } | null;
}

const EVENT_SELECT = "*, membership:bd_memberships!bd_events_membership_id_fkey(id, organization)";

export function useBdEvents() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-events"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_events")
        .select(EVENT_SELECT)
        .order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const events = (data || []) as unknown as BdEvent[];
      if (events.length === 0) return events;
      const ids = events.map((e) => e.id);
      const [{ data: att }, { data: leads }] = await Promise.all([
        supabase.from("bd_event_attendees").select("event_id").in("event_id", ids),
        supabase.from("leads").select("event_id, expected_value, stage").in("event_id", ids).is("deleted_at", null),
      ]);
      const aCount = new Map<string, number>();
      (att || []).forEach((r: any) => aCount.set(r.event_id, (aCount.get(r.event_id) ?? 0) + 1));
      const lCount = new Map<string, number>();
      const pipe = new Map<string, number>();
      (leads || []).forEach((r: any) => {
        lCount.set(r.event_id, (lCount.get(r.event_id) ?? 0) + 1);
        if (r.stage !== "LOST") pipe.set(r.event_id, (pipe.get(r.event_id) ?? 0) + Number(r.expected_value || 0));
      });
      return events.map((e) => ({
        ...e,
        attendee_count: aCount.get(e.id) ?? 0,
        lead_count: lCount.get(e.id) ?? 0,
        pipeline_generated: pipe.get(e.id) ?? 0,
      }));
    },
  });
}

export function useBdEvent(id: string | undefined) {
  return useQuery({
    queryKey: ["bd-event", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("bd_events").select(EVENT_SELECT).eq("id", id as string).maybeSingle();
      if (error) throw error;
      return (data as unknown as BdEvent) ?? null;
    },
  });
}

export function useCreateBdEvent() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BdEvent> & { name: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase.from("bd_events").insert({
        ...input,
        company_id: profile.company_id,
        created_by: profile.id,
        proposed_by: input.proposed_by ?? profile.id,
        status: input.status ?? "PENDING_APPROVAL",
      } as any).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-events"] }),
  });
}

export function useUpdateBdEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<BdEvent>) => {
      const { error } = await supabase.from("bd_events").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["bd-events"] });
      qc.invalidateQueries({ queryKey: ["bd-event", v.id] });
    },
  });
}

export function useDeleteBdEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bd_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-events"] }),
  });
}

// ---- Attendees ----
export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  rsvp_status: string | null;
  attended: boolean;
  created_at: string;
  user?: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
}

export function useEventAttendees(eventId: string | undefined) {
  return useQuery({
    queryKey: ["bd-event-attendees", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_event_attendees")
        .select("*, user:profiles!bd_event_attendees_user_id_fkey(id, first_name, last_name, avatar_url)")
        .eq("event_id", eventId as string);
      if (error) throw error;
      return (data || []) as unknown as EventAttendee[];
    },
  });
}

export function useAddEventAttendee() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ event_id, user_id, rsvp_status }: { event_id: string; user_id: string; rsvp_status?: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("bd_event_attendees").upsert({
        company_id: profile.company_id,
        event_id, user_id, rsvp_status: rsvp_status ?? "ACCEPTED", created_by: profile.id,
      } as any, { onConflict: "event_id,user_id" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["bd-event-attendees", v.event_id] }),
  });
}

export function useUpdateEventAttendee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, event_id, ...updates }: { id: string; event_id: string; rsvp_status?: string; attended?: boolean }) => {
      const { error } = await supabase.from("bd_event_attendees").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["bd-event-attendees", v.event_id] }),
  });
}

export function useRemoveEventAttendee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; event_id: string }) => {
      const { error } = await supabase.from("bd_event_attendees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["bd-event-attendees", v.event_id] }),
  });
}

// ---- Sources ----
export interface EventSource {
  id: string;
  company_id: string;
  name: string;
  url: string;
  check_frequency: CheckFrequency;
  priority: SourcePriority;
  last_checked_at: string | null;
  last_checked_by: string | null;
  notes: string | null;
  created_at: string;
}

export function useEventSources() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-event-sources"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("bd_event_sources").select("*").order("priority").order("name");
      if (error) throw error;
      return (data || []) as unknown as EventSource[];
    },
  });
}

export function useUpsertEventSource() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<EventSource> & { name: string; url: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      if (input.id) {
        const { id, ...updates } = input;
        const { error } = await supabase.from("bd_event_sources").update(updates as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bd_event_sources").insert({
          ...input,
          company_id: profile.company_id,
          created_by: profile.id,
          check_frequency: input.check_frequency ?? "MONTHLY",
          priority: input.priority ?? "MED",
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-event-sources"] }),
  });
}

export function useMarkSourceChecked() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bd_event_sources").update({
        last_checked_at: new Date().toISOString(),
        last_checked_by: profile?.id ?? null,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-event-sources"] }),
  });
}

export function useDeleteEventSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bd_event_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-event-sources"] }),
  });
}

// ---- Memberships ----
export interface BdMembership {
  id: string;
  organization: string;
  status: MembershipStatus;
  annual_cost: number | null;
  member_since: string | null;
  next_renewal: string | null;
  login_username: string | null;
  notes: string | null;
}

export function useMemberships() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-memberships"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("bd_memberships").select("*").order("organization");
      if (error) throw error;
      return (data || []) as unknown as BdMembership[];
    },
  });
}

export function useUpsertMembership() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BdMembership> & { organization: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      if (input.id) {
        const { id, ...updates } = input;
        const { error } = await supabase.from("bd_memberships").update(updates as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bd_memberships").insert({
          ...input,
          company_id: profile.company_id,
          created_by: profile.id,
          status: input.status ?? "EVALUATING",
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-memberships"] }),
  });
}

export function useDeleteMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bd_memberships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-memberships"] }),
  });
}
