import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BillingRuleDocument {
  id: string;
  company_id: string;
  billing_rule_id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  revised_at: string | null;
  notes: string | null;
  created_at: string;
}

export function useBillingRuleDocuments(billingRuleId: string | null | undefined) {
  return useQuery({
    queryKey: ["billing-rule-documents", billingRuleId],
    enabled: !!billingRuleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_rule_documents")
        .select("*")
        .eq("billing_rule_id", billingRuleId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data as BillingRuleDocument[];
    },
  });
}

export function useUploadBillingRuleDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      billing_rule_id: string;
      file: File;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, id")
        .single();
      if (!profile) throw new Error("No profile");

      const ext = payload.file.name.split(".").pop();
      const safeName = payload.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${profile.company_id}/${payload.billing_rule_id}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("billing-rule-docs")
        .upload(path, payload.file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from("billing_rule_documents")
        .insert({
          company_id: profile.company_id,
          billing_rule_id: payload.billing_rule_id,
          filename: payload.file.name,
          storage_path: path,
          mime_type: payload.file.type || null,
          size_bytes: payload.file.size,
          uploaded_by: profile.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-rule-documents"] });
    },
  });
}

export function useDeleteBillingRuleDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: BillingRuleDocument) => {
      await supabase.storage.from("billing-rule-docs").remove([doc.storage_path]);
      const { error } = await supabase
        .from("billing_rule_documents")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-rule-documents"] });
    },
  });
}

export function useUpdateBillingRuleDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      doc: BillingRuleDocument;
      newFile: File;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, id")
        .single();
      if (!profile) throw new Error("No profile");

      // Remove old file
      await supabase.storage.from("billing-rule-docs").remove([payload.doc.storage_path]);

      // Upload new
      const safeName = payload.newFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${profile.company_id}/${payload.doc.billing_rule_id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("billing-rule-docs")
        .upload(path, payload.newFile);
      if (uploadError) throw uploadError;

      const { error } = await supabase
        .from("billing_rule_documents")
        .update({
          filename: payload.newFile.name,
          storage_path: path,
          mime_type: payload.newFile.type || null,
          size_bytes: payload.newFile.size,
          revised_at: new Date().toISOString(),
        })
        .eq("id", payload.doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-rule-documents"] });
    },
  });
}

export function useDownloadBillingRuleDocument() {
  return async (doc: BillingRuleDocument) => {
    const { data, error } = await supabase.storage
      .from("billing-rule-docs")
      .download(doc.storage_path);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
}
