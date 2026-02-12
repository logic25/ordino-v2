import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RfiFieldConfig {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "number" | "select" | "checkbox" | "checkbox_group" | "currency" | "heading" | "file_upload" | "work_type_picker";
  placeholder?: string;
  required?: boolean;
  options?: string[];
  width?: "full" | "half";
  accept?: string;
  maxFiles?: number;
  /** If true, this field group (from this heading to the next heading) is repeatable */
  repeatableGroup?: boolean;
  maxRepeatGroup?: number;
}

export interface RfiSectionConfig {
  id: string;
  title: string;
  description?: string;
  fields: RfiFieldConfig[];
  repeatable?: boolean;
  maxRepeat?: number;
}

export interface RfiTemplate {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  sections: RfiSectionConfig[];
  created_at: string | null;
  updated_at: string | null;
}

export interface RfiRequest {
  id: string;
  company_id: string;
  template_id: string | null;
  project_id: string | null;
  proposal_id: string | null;
  property_id: string | null;
  title: string;
  recipient_name: string | null;
  recipient_email: string | null;
  status: string;
  access_token: string;
  sections: RfiSectionConfig[];
  responses: Record<string, any>;
  submitted_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Default PIS template – regrouped for a seamless client experience
export const DEFAULT_PIS_SECTIONS: RfiSectionConfig[] = [
  {
    id: "building_and_scope",
    title: "Building Details & Scope of Work",
    description: "Verify the property info and enter costs for each applicable work type",
    fields: [
      { id: "project_address", label: "Project Address", type: "text", required: true, width: "full" },
      { id: "borough", label: "Borough", type: "text", width: "half" },
      { id: "block", label: "Block", type: "text", width: "half" },
      { id: "lot", label: "Lot", type: "text", width: "half" },
      { id: "floors", label: "Floor(s)", type: "text", width: "half" },
      { id: "apt_numbers", label: "Apt #(s)", type: "text", width: "half" },
      { id: "sq_ft", label: "Area (sq ft)", type: "number", width: "half" },
      { id: "scope_heading", label: "Scope of Work & Cost Breakdown", type: "heading" },
      { id: "job_description", label: "Job Description", type: "textarea", required: true, width: "full", placeholder: "Describe the work in detail..." },
      { id: "work_types", label: "Select Applicable Work Types", type: "work_type_picker", width: "full", options: ["Architectural", "Structural", "Mechanical", "Plumbing", "Sprinkler", "Fire Alarm", "Fire Suppression", "Standpipe", "Fuel Burning", "Boiler", "Fuel Storage", "Curb Cut", "Other"] },
      { id: "directive_14", label: "Directive 14?", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "plans_upload", label: "Upload Plans / Drawings", type: "file_upload", width: "full", accept: ".pdf,.dwg,.dxf,.jpg,.jpeg,.png", maxFiles: 10, placeholder: "PDF, DWG, DXF, JPG, or PNG files" },
    ],
  },
  {
    id: "applicant_and_owner",
    title: "Applicant & Building Owner",
    description: "Licensed professional and building owner details",
    fields: [
      { id: "applicant_heading", label: "Applicant (Architect / Engineer)", type: "heading", repeatableGroup: true, maxRepeatGroup: 5 },
      { id: "applicant_name", label: "Full Name", type: "text", required: true, width: "half" },
      { id: "applicant_business_name", label: "Business Name", type: "text", width: "half" },
      { id: "applicant_business_address", label: "Business Address", type: "text", width: "full" },
      { id: "applicant_phone", label: "Phone", type: "phone", width: "half" },
      { id: "applicant_email", label: "Email", type: "email", width: "half" },
      { id: "applicant_nys_lic", label: "NYS License #", type: "text", width: "half" },
      { id: "applicant_lic_type", label: "License Type", type: "select", options: ["RA", "PE"], width: "half" },
      { id: "applicant_work_types", label: "Work Types", type: "checkbox_group", width: "full", options: [] },
      { id: "owner_heading", label: "Building Owner", type: "heading" },
      { id: "ownership_type", label: "Ownership Type", type: "select", options: ["Individual", "Corporation", "Partnership", "Condo/Co-op", "Non-profit", "Government"], width: "half" },
      { id: "non_profit", label: "Non-Profit?", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "owner_name", label: "Owner Name", type: "text", required: true, width: "half" },
      { id: "owner_title", label: "Title", type: "text", width: "half" },
      { id: "owner_company", label: "Company / Entity Name", type: "text", width: "full" },
      { id: "owner_address", label: "Address", type: "text", width: "full" },
      { id: "owner_email", label: "Email", type: "email", width: "half" },
      { id: "owner_phone", label: "Phone", type: "phone", width: "half" },
      { id: "corp_officer_heading", label: "Corporate Officer (if Corp/Partnership)", type: "heading" },
      { id: "corp_officer_name", label: "Officer Name", type: "text", width: "half" },
      { id: "corp_officer_title", label: "Officer Title", type: "text", width: "half" },
    ],
    repeatable: false,
  },
  {
    id: "contractors_inspections",
    title: "GC, TPP & Special Inspections",
    description: "Check 'Same as Applicant' to auto-fill from above",
    fields: [
      { id: "gc_heading", label: "General Contractor", type: "heading" },
      { id: "gc_same_as", label: "Same as Applicant", type: "checkbox", width: "full" },
      { id: "gc_name", label: "Name", type: "text", width: "half" },
      { id: "gc_company", label: "Company", type: "text", width: "half" },
      { id: "gc_phone", label: "Phone", type: "phone", width: "half" },
      { id: "gc_email", label: "Email", type: "email", width: "half" },
      { id: "gc_address", label: "Address", type: "text", width: "full" },
      { id: "gc_dob_tracking", label: "DOB Tracking #", type: "text", width: "half" },
      { id: "gc_hic_lic", label: "HIC License #", type: "text", width: "half" },
      { id: "tpp_heading", label: "TPP Applicant", type: "heading" },
      { id: "tpp_same_as", label: "Same as Applicant", type: "checkbox", width: "full" },
      { id: "tpp_name", label: "Name", type: "text", width: "half" },
      { id: "tpp_email", label: "Email", type: "email", width: "half" },
      { id: "rent_controlled", label: "Rent Controlled?", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "rent_stabilized", label: "Rent Stabilized?", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "units_occupied", label: "Occupied Units", type: "number", width: "half" },
      { id: "sia_heading", label: "Special Inspections (SIA)", type: "heading" },
      { id: "sia_same_as", label: "Same as Applicant", type: "checkbox", width: "full" },
      { id: "sia_name", label: "Name", type: "text", width: "half" },
      { id: "sia_company", label: "Company", type: "text", width: "half" },
      { id: "sia_phone", label: "Phone", type: "phone", width: "half" },
      { id: "sia_email", label: "Email", type: "email", width: "half" },
      { id: "sia_number", label: "SIA #", type: "text", width: "half" },
      { id: "sia_nys_lic", label: "NYS License #", type: "text", width: "half" },
    ],
  },
];

export function useRfiTemplates() {
  return useQuery({
    queryKey: ["rfi-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfi_templates" as any)
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data || []) as unknown as RfiTemplate[];
    },
  });
}

export function useCreateRfiTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; sections: RfiSectionConfig[]; is_default?: boolean }) => {
      const { data: profile } = await supabase.from("profiles").select("company_id").single();
      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await (supabase.from("rfi_templates" as any) as any)
        .insert({
          company_id: profile.company_id,
          name: input.name,
          description: input.description || null,
          sections: input.sections,
          is_default: input.is_default || false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RfiTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfi-templates"] });
    },
  });
}

export function useUpdateRfiTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; description?: string; sections?: RfiSectionConfig[]; is_default?: boolean }) => {
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.sections !== undefined) updateData.sections = input.sections;
      if (input.is_default !== undefined) updateData.is_default = input.is_default;

      const { data, error } = await (supabase.from("rfi_templates" as any) as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RfiTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfi-templates"] });
    },
  });
}

export function useDeleteRfiTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("rfi_templates" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfi-templates"] });
    },
  });
}

export function useRfiRequests() {
  return useQuery({
    queryKey: ["rfi-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfi_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RfiRequest[];
    },
  });
}

export function useCreateRfiRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      template_id?: string;
      project_id?: string;
      proposal_id?: string;
      property_id?: string;
      title: string;
      recipient_name?: string;
      recipient_email?: string;
      sections: RfiSectionConfig[];
    }) => {
      const { data: profile } = await supabase.from("profiles").select("id, company_id").single();
      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await (supabase.from("rfi_requests" as any) as any)
        .insert({
          company_id: profile.company_id,
          template_id: input.template_id || null,
          project_id: input.project_id || null,
          proposal_id: input.proposal_id || null,
          property_id: input.property_id || null,
          title: input.title,
          recipient_name: input.recipient_name || null,
          recipient_email: input.recipient_email || null,
          sections: input.sections,
          created_by: profile.id,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RfiRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfi-requests"] });
    },
  });
}

// Public: fetch an RFI by access token with property data
export function useRfiByToken(token: string | null) {
  return useQuery({
    queryKey: ["rfi-public", token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from("rfi_requests" as any)
        .select("*, properties(*)")
        .eq("access_token", token)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { properties, ...rfi } = data as any;
      return {
        rfi: rfi as RfiRequest,
        property: properties as { address: string; borough: string | null; block: string | null; lot: string | null } | null,
      };
    },
    enabled: !!token,
  });
}
