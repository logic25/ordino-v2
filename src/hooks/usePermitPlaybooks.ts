import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  makeEmptyQA,
  type PlaybookQAItem,
  type PlaybookAttachment,
  PLAYBOOK_STANDARD_SLOTS,
} from "@/lib/permitPlaybookTemplate";

export type PermitPlaybook = {
  id: string;
  company_id: string;
  market_id: string;
  permit_type: string;
  summary: string | null;
  qa: PlaybookQAItem[];
  attachments: PlaybookAttachment[];
  last_verified_at: string | null;
  last_ai_research_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const BUCKET = "permit-playbooks";

function normalize(row: any): PermitPlaybook {
  return {
    ...row,
    qa: Array.isArray(row.qa) ? row.qa : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
  };
}

export function usePlaybooksForMarket(marketId: string | undefined) {
  return useQuery({
    queryKey: ["permit_playbooks", "market", marketId],
    enabled: !!marketId,
    queryFn: async (): Promise<PermitPlaybook[]> => {
      const { data, error } = await supabase
        .from("permit_playbooks")
        .select("*")
        .eq("market_id", marketId!)
        .order("permit_type", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(normalize);
    },
  });
}

export function usePlaybook(id: string | undefined) {
  return useQuery({
    queryKey: ["permit_playbooks", "id", id],
    enabled: !!id,
    queryFn: async (): Promise<PermitPlaybook | null> => {
      const { data, error } = await supabase
        .from("permit_playbooks")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? normalize(data) : null;
    },
  });
}

export function useCreatePlaybook() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (input: { market_id: string; permit_type: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase
        .from("permit_playbooks")
        .insert({
          company_id: profile.company_id,
          market_id: input.market_id,
          permit_type: input.permit_type.trim(),
          created_by: profile.id,
          qa: makeEmptyQA() as any,
          attachments: [] as any,
        })
        .select()
        .single();
      if (error) throw error;
      return normalize(data);
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "market", row.market_id] });
    },
  });
}

export function useDeletePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; market_id: string }) => {
      const { error } = await supabase.from("permit_playbooks").delete().eq("id", p.id);
      if (error) throw error;
      return p;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "market", p.market_id] });
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", p.id] });
    },
  });
}

async function writePlaybook(id: string, patch: Partial<PermitPlaybook>) {
  const payload: Record<string, any> = { ...patch };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;
  delete payload.company_id;
  const { data, error } = await supabase
    .from("permit_playbooks")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

export function useUpdatePlaybookSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; summary: string | null }) =>
      writePlaybook(p.id, { summary: p.summary }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", row.id] });
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "market", row.market_id] });
    },
  });
}

function recomputeLastVerified(qa: PlaybookQAItem[]): string | null {
  if (qa.length > 0 && qa.every((s) => s.verified)) return new Date().toISOString();
  return null;
}

export function useUpdateSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      playbook: PermitPlaybook;
      slotId: string;
      patch: Partial<PlaybookQAItem>;
    }) => {
      const nextQa = p.playbook.qa.map((s) => (s.id === p.slotId ? { ...s, ...p.patch } : s));
      return writePlaybook(p.playbook.id, {
        qa: nextQa as any,
        last_verified_at: recomputeLastVerified(nextQa) ?? p.playbook.last_verified_at,
      });
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", row.id] });
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "market", row.market_id] });
    },
  });
}

export function useVerifySlot() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (p: { playbook: PermitPlaybook; slotId: string; verified: boolean }) => {
      const verifierName = profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;
      const nextQa = p.playbook.qa.map((s) => {
        if (s.id !== p.slotId) return s;
        if (p.verified) {
          return {
            ...s,
            verified: true,
            verified_by: profile?.id ?? null,
            verified_by_name: verifierName,
            verified_at: new Date().toISOString(),
            ai_generated: false,
          };
        }
        return { ...s, verified: false, verified_by: null, verified_by_name: null, verified_at: null };
      });
      return writePlaybook(p.playbook.id, {
        qa: nextQa as any,
        last_verified_at: recomputeLastVerified(nextQa),
      });
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", row.id] });
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "market", row.market_id] });
    },
  });
}

export function useAddCustomSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { playbook: PermitPlaybook; question: string }) => {
      const nextQa: PlaybookQAItem[] = [
        ...p.playbook.qa,
        {
          id: `custom_${crypto.randomUUID().slice(0, 8)}`,
          question: p.question.trim(),
          answer: "",
          kind: "text",
          ai_generated: false,
          verified: false,
        },
      ];
      return writePlaybook(p.playbook.id, { qa: nextQa as any });
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", row.id] }),
  });
}

export function useRemoveSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { playbook: PermitPlaybook; slotId: string }) => {
      const nextQa = p.playbook.qa.filter((s) => s.id !== p.slotId);
      return writePlaybook(p.playbook.id, { qa: nextQa as any });
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", row.id] }),
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (p: { playbook: PermitPlaybook; file: File }) => {
      const safe = p.file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${p.playbook.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, p.file, {
        upsert: false,
        contentType: p.file.type || undefined,
      });
      if (upErr) throw upErr;
      const att: PlaybookAttachment = {
        id: crypto.randomUUID(),
        name: p.file.name,
        storage_path: path,
        size: p.file.size,
        uploaded_at: new Date().toISOString(),
        uploaded_by: profile?.id ?? null,
      };
      return writePlaybook(p.playbook.id, {
        attachments: [...p.playbook.attachments, att] as any,
      });
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", row.id] }),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { playbook: PermitPlaybook; attachmentId: string }) => {
      const target = p.playbook.attachments.find((a) => a.id === p.attachmentId);
      if (target?.storage_path) {
        await supabase.storage.from(BUCKET).remove([target.storage_path]);
      }
      const next = p.playbook.attachments.filter((a) => a.id !== p.attachmentId);
      return writePlaybook(p.playbook.id, { attachments: next as any });
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", row.id] }),
  });
}

export async function getAttachmentUrl(storage_path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storage_path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export type AISuggestion = { id: string; answer: string; source?: string | null; confidence?: number | null };

export function useResearchPlaybook() {
  return useMutation({
    mutationFn: async (p: {
      playbook: PermitPlaybook;
      marketName: string;
      state: string;
      slotIds?: string[]; // if provided, only research these
    }): Promise<AISuggestion[]> => {
      const targetIds = new Set(
        p.slotIds && p.slotIds.length > 0
          ? p.slotIds
          : p.playbook.qa.filter((s) => !s.verified && (!s.answer || s.answer.trim() === "")).map((s) => s.id),
      );
      const questions = p.playbook.qa
        .filter((s) => targetIds.has(s.id))
        .map((s) => ({ id: s.id, question: s.question, kind: s.kind }));

      if (questions.length === 0) return [];

      const { data, error } = await supabase.functions.invoke("research-playbook", {
        body: {
          market_name: p.marketName,
          state: p.state,
          permit_type: p.playbook.permit_type,
          questions,
        },
      });
      if (error) throw error;
      return ((data?.suggestions ?? []) as AISuggestion[]).filter((s) => targetIds.has(s.id));
    },
  });
}

export function useApplyAIDraftToEmptySlots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { playbook: PermitPlaybook; suggestions: AISuggestion[] }) => {
      const map = new Map(p.suggestions.map((s) => [s.id, s]));
      const nextQa = p.playbook.qa.map((slot) => {
        if (slot.verified) return slot; // never overwrite verified
        const sug = map.get(slot.id);
        if (!sug) return slot;
        if (!sug.answer || sug.answer.trim() === "") return slot;
        return {
          ...slot,
          answer: sug.answer,
          ai_generated: true,
          verified: false,
          source: sug.source ?? null,
          confidence: sug.confidence ?? null,
        };
      });
      return writePlaybook(p.playbook.id, {
        qa: nextQa as any,
        last_ai_research_at: new Date().toISOString(),
      });
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "id", row.id] });
      qc.invalidateQueries({ queryKey: ["permit_playbooks", "market", row.market_id] });
    },
  });
}

export { PLAYBOOK_STANDARD_SLOTS };
