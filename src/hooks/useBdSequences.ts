import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

export type SequenceStatus = Database["public"]["Enums"]["bd_sequence_status"];

export interface Sequence {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  target_persona: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  step_count?: number;
  active_enrollments?: number;
}

export interface SequenceStep {
  id: string;
  company_id: string;
  sequence_id: string;
  step_number: number;
  day_offset: number;
  subject: string | null;
  body_template: string | null;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  lead_id: string;
  current_step: number;
  status: SequenceStatus;
  last_sent_at: string | null;
  paused_reason: string | null;
  created_at: string;
  sequence?: { id: string; name: string };
  lead?: { id: string; full_name: string; company: string | null; contact_email: string | null };
}

// ---- Sequences ----
export function useSequences() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-sequences"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("bd_sequences").select("*").order("name");
      if (error) throw error;
      const seqs = (data || []) as Sequence[];
      if (seqs.length === 0) return seqs;
      const ids = seqs.map((s) => s.id);
      const [{ data: steps }, { data: enrolls }] = await Promise.all([
        supabase.from("bd_sequence_steps").select("sequence_id").in("sequence_id", ids),
        supabase.from("bd_sequence_enrollments").select("sequence_id, status").in("sequence_id", ids),
      ]);
      const sCount = new Map<string, number>();
      (steps || []).forEach((r: any) => sCount.set(r.sequence_id, (sCount.get(r.sequence_id) ?? 0) + 1));
      const eCount = new Map<string, number>();
      (enrolls || []).forEach((r: any) => {
        if (r.status === "ACTIVE") eCount.set(r.sequence_id, (eCount.get(r.sequence_id) ?? 0) + 1);
      });
      return seqs.map((s) => ({
        ...s,
        step_count: sCount.get(s.id) ?? 0,
        active_enrollments: eCount.get(s.id) ?? 0,
      }));
    },
  });
}

export function useUpsertSequence() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Sequence> & { name: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      if (input.id) {
        const { id, ...updates } = input;
        const { error } = await supabase.from("bd_sequences").update(updates as any).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from("bd_sequences").insert({
        ...input,
        company_id: profile.company_id,
        created_by: profile.id,
      } as any).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-sequences"] }),
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bd_sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-sequences"] }),
  });
}

// ---- Steps ----
export function useSequenceSteps(sequenceId: string | undefined) {
  return useQuery({
    queryKey: ["bd-sequence-steps", sequenceId],
    enabled: !!sequenceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_sequence_steps").select("*")
        .eq("sequence_id", sequenceId as string)
        .order("step_number");
      if (error) throw error;
      return (data || []) as SequenceStep[];
    },
  });
}

export function useUpsertStep() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SequenceStep> & { sequence_id: string; step_number: number }) => {
      if (!profile?.company_id) throw new Error("No company");
      if (input.id) {
        const { id, ...updates } = input;
        const { error } = await supabase.from("bd_sequence_steps").update(updates as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bd_sequence_steps").insert({
          ...input,
          company_id: profile.company_id,
          created_by: profile.id,
          day_offset: input.day_offset ?? 0,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["bd-sequence-steps", v.sequence_id] }),
  });
}

export function useDeleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; sequence_id: string }) => {
      const { error } = await supabase.from("bd_sequence_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["bd-sequence-steps", v.sequence_id] }),
  });
}

// ---- Enrollments ----
const ENROLL_SELECT =
  "*, sequence:bd_sequences!bd_sequence_enrollments_sequence_id_fkey(id, name), " +
  "lead:leads!bd_sequence_enrollments_lead_id_fkey(id, full_name, company, contact_email)";

export function useSequenceEnrollments(opts?: { sequence_id?: string; lead_id?: string; status?: SequenceStatus }) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-enrollments", opts ?? {}],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      let q = supabase.from("bd_sequence_enrollments").select(ENROLL_SELECT).order("created_at", { ascending: false });
      if (opts?.sequence_id) q = q.eq("sequence_id", opts.sequence_id);
      if (opts?.lead_id) q = q.eq("lead_id", opts.lead_id);
      if (opts?.status) q = q.eq("status", opts.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SequenceEnrollment[];
    },
  });
}

export function useEnrollLead() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sequence_id, lead_ids }: { sequence_id: string; lead_ids: string[] }) => {
      if (!profile?.company_id) throw new Error("No company");
      const rows = lead_ids.map((lead_id) => ({
        company_id: profile.company_id, sequence_id, lead_id, created_by: profile.id,
        current_step: 0, status: "ACTIVE" as SequenceStatus,
      }));
      const { error } = await supabase.from("bd_sequence_enrollments").upsert(rows as any, {
        onConflict: "sequence_id,lead_id", ignoreDuplicates: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bd-enrollments"] });
      qc.invalidateQueries({ queryKey: ["bd-sequences"] });
    },
  });
}

export function useUpdateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: SequenceStatus; current_step?: number; last_sent_at?: string | null; paused_reason?: string | null }) => {
      const { error } = await supabase.from("bd_sequence_enrollments").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-enrollments"] }),
  });
}

// ---- Queue (active enrollments whose next step is due) ----
export interface QueueItem {
  enrollment: SequenceEnrollment;
  next_step: SequenceStep;
  due_at: string;
  overdue: boolean;
}

export function useSequenceQueue() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-sequence-queue"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data: enrolls, error } = await supabase
        .from("bd_sequence_enrollments")
        .select(ENROLL_SELECT)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const list = (enrolls || []) as unknown as SequenceEnrollment[];
      if (list.length === 0) return [] as QueueItem[];
      const seqIds = [...new Set(list.map((e) => e.sequence_id))];
      const { data: steps } = await supabase.from("bd_sequence_steps").select("*").in("sequence_id", seqIds).order("step_number");
      const stepsBySeq = new Map<string, SequenceStep[]>();
      (steps || []).forEach((s: any) => {
        const arr = stepsBySeq.get(s.sequence_id) ?? [];
        arr.push(s); stepsBySeq.set(s.sequence_id, arr);
      });
      const now = Date.now();
      const out: QueueItem[] = [];
      for (const e of list) {
        const stepsForSeq = stepsBySeq.get(e.sequence_id) ?? [];
        const nextIdx = e.current_step; // 0-based pointer to next step to send
        if (nextIdx >= stepsForSeq.length) continue;
        const next = stepsForSeq[nextIdx];
        // due_at: created_at + day_offset days (or last_sent_at + (next.day_offset - prev.day_offset))
        const base = e.last_sent_at ? new Date(e.last_sent_at) : new Date(e.created_at);
        const prevOffset = nextIdx > 0 ? stepsForSeq[nextIdx - 1].day_offset : 0;
        const dayDelta = next.day_offset - prevOffset;
        const due = new Date(base.getTime() + dayDelta * 86400000);
        out.push({
          enrollment: e, next_step: next,
          due_at: due.toISOString(),
          overdue: due.getTime() <= now,
        });
      }
      return out.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
    },
  });
}

export function useMarkStepSent() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ enrollment_id, completed }: { enrollment_id: string; completed: boolean }) => {
      // increment current_step; if completed, set status COMPLETED
      const { data: enr } = await supabase.from("bd_sequence_enrollments")
        .select("current_step, sequence_id").eq("id", enrollment_id).single();
      const nextStep = (enr?.current_step ?? 0) + 1;
      const updates: any = { current_step: nextStep, last_sent_at: new Date().toISOString() };
      if (completed) updates.status = "COMPLETED";
      const { error } = await supabase.from("bd_sequence_enrollments").update(updates).eq("id", enrollment_id);
      if (error) throw error;
      // log activity on the lead
      if (enr) {
        const { data: enrFull } = await supabase.from("bd_sequence_enrollments").select("lead_id, company_id").eq("id", enrollment_id).single();
        if (enrFull && profile) {
          await supabase.from("bd_activities").insert({
            company_id: enrFull.company_id, lead_id: enrFull.lead_id,
            type: "SYSTEM", content: `Sequence step ${nextStep} marked sent`,
            created_by: profile.id,
          } as any);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bd-sequence-queue"] });
      qc.invalidateQueries({ queryKey: ["bd-enrollments"] });
    },
  });
}
