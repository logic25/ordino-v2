import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RfiFieldConfig {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "number" | "select" | "checkbox" | "checkbox_group" | "currency" | "heading";
  placeholder?: string;
  required?: boolean;
  options?: string[];
  width?: "full" | "half";
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

// Default PIS template based on the Green Light Expediting form
export const DEFAULT_PIS_SECTIONS: RfiSectionConfig[] = [
  {
    id: "project_info",
    title: "Project Information",
    description: "Basic details about the project location and scope",
    fields: [
      { id: "project_address", label: "Full Project Address", type: "text", required: true, width: "full" },
      { id: "floors", label: "Floor(s) Where Work is to be Performed", type: "text", width: "half" },
      { id: "apt_numbers", label: "Apt #(s)", type: "text", width: "half" },
      { id: "job_description", label: "Job Description", type: "textarea", required: true, width: "full", placeholder: "Describe the scope of work in detail..." },
      { id: "sq_ft", label: "Sq. Ft. of Area of Work", type: "number", width: "half" },
    ],
  },
  {
    id: "building_info",
    title: "Building Information",
    description: "Details about the building and occupancy",
    fields: [
      { id: "rent_controlled", label: "Rent Controlled Building", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "rent_stabilized", label: "Rent Stabilized Building", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "units_occupied", label: "# of Units to Remain Occupied During Construction", type: "number", width: "half" },
    ],
  },
  {
    id: "tpp_info",
    title: "TPP Applicant Info",
    description: "Tenant Protection Plan applicant (required if building has occupied residential units)",
    fields: [
      { id: "tpp_name", label: "Name", type: "text", width: "half" },
      { id: "tpp_email", label: "Email Address", type: "email", width: "half" },
    ],
  },
  {
    id: "work_types",
    title: "Work Types",
    description: "Check all that apply",
    fields: [
      {
        id: "work_type_selection",
        label: "Work Type(s)",
        type: "checkbox_group",
        width: "full",
        options: [
          "EQ - Const. Equipment", "Chute", "Fence", "Sidewalk Shed", "Supported Scaffold",
          "OT - Architectural", "Structural", "MH - Mechanical", "PL - Plumbing",
          "SP - Sprinkler", "FA - Fire Alarm", "FP - Fire Suppression", "FS - Fuel Storage",
          "SD - Standpipe", "FB - Fuel Burning", "CC - Curb Cut", "BL - Boiler",
          "FPP - Fire Protection Plan", "BPP - Building Pavement Plan",
        ],
      },
      { id: "work_type_other", label: "Other Work Type", type: "text", width: "full", placeholder: "Specify if not listed above..." },
      { id: "architectural_filing_code", label: "Architectural Filing Code", type: "text", width: "half" },
      { id: "directive_14", label: "Directive 14?", type: "select", options: ["Yes", "No"], width: "half" },
    ],
  },
  {
    id: "costs",
    title: "Cost Breakdown",
    description: "Estimated costs by trade",
    fields: [
      { id: "cost_architectural", label: "Architectural", type: "currency", width: "half" },
      { id: "cost_plumbing", label: "Plumbing", type: "currency", width: "half" },
      { id: "cost_mechanical", label: "Mechanical", type: "currency", width: "half" },
      { id: "cost_sprinkler", label: "Sprinkler", type: "currency", width: "half" },
      { id: "cost_structural", label: "Structural", type: "currency", width: "half" },
      { id: "cost_fire_alarm", label: "Fire Alarm", type: "currency", width: "half" },
      { id: "cost_fire_suppression", label: "Fire Suppression", type: "currency", width: "half" },
      { id: "cost_standpipe", label: "Standpipe", type: "currency", width: "half" },
      { id: "cost_other", label: "Other", type: "currency", width: "half" },
    ],
  },
  {
    id: "applicant_info",
    title: "Applicant Information",
    description: "NYS Licensed Architect and/or Engineer(s) to sign and seal plans",
    repeatable: true,
    maxRepeat: 4,
    fields: [
      { id: "applicant_name", label: "Applicant Name", type: "text", required: true, width: "half" },
      { id: "company_name", label: "Company Name", type: "text", width: "half" },
      { id: "address", label: "Address", type: "text", width: "full" },
      { id: "phone", label: "Phone", type: "phone", width: "half" },
      { id: "email", label: "Email", type: "email", width: "half" },
      { id: "nys_lic", label: "NYS License #", type: "text", width: "half" },
      { id: "work_types", label: "Work Types", type: "text", width: "half" },
    ],
  },
  {
    id: "ownership_info",
    title: "Building Ownership Information",
    description: "Details about the building owner",
    fields: [
      { id: "signatory_name", label: "Signatory Name", type: "text", required: true, width: "half" },
      { id: "job_title", label: "Job Title", type: "text", width: "half" },
      { id: "owner_company", label: "Company Name", type: "text", width: "full" },
      { id: "owner_address", label: "Street Address", type: "text", width: "full" },
      { id: "owner_email", label: "Email", type: "email", width: "half" },
      { id: "owner_phone", label: "Phone", type: "phone", width: "half" },
      { id: "ownership_type", label: "Type of Ownership", type: "select", options: ["Individual", "Corporation", "Partnership", "Condo/Co-op", "Non-profit", "Government"], width: "half" },
      { id: "non_profit", label: "Non-Profit", type: "select", options: ["Yes", "No"], width: "half" },
    ],
  },
  {
    id: "special_inspections",
    title: "Special Inspections Agency",
    description: "If applicable",
    fields: [
      { id: "sia_name", label: "Name", type: "text", width: "half" },
      { id: "sia_phone", label: "Phone", type: "phone", width: "half" },
      { id: "sia_company", label: "Company Name", type: "text", width: "half" },
      { id: "sia_email", label: "Email", type: "email", width: "half" },
      { id: "sia_address", label: "Address", type: "text", width: "full" },
      { id: "sia_number", label: "SIA #", type: "text", width: "half" },
      { id: "sia_nys_lic", label: "NYS License #", type: "text", width: "half" },
    ],
  },
  {
    id: "gc_info",
    title: "General Contractor Info",
    description: "If applicable",
    fields: [
      { id: "gc_name", label: "Signatory Name", type: "text", width: "half" },
      { id: "gc_phone", label: "Phone", type: "phone", width: "half" },
      { id: "gc_company", label: "Company Name", type: "text", width: "half" },
      { id: "gc_email", label: "Email", type: "email", width: "half" },
      { id: "gc_address", label: "Address", type: "text", width: "full" },
      { id: "gc_taxpayer_id", label: "Taxpayer ID", type: "text", width: "half" },
      { id: "gc_dob_tracking", label: "DOB Tracking #", type: "text", width: "half" },
      { id: "gc_hic_lic", label: "HIC Lic # (if residential)", type: "text", width: "half" },
    ],
  },
  {
    id: "construction_super",
    title: "Construction Superintendent Info",
    description: "Required for New Buildings, Alterations >50%, Enlargements, Full Demos",
    fields: [
      { id: "super_name", label: "Name", type: "text", width: "half" },
      { id: "super_email", label: "Email", type: "email", width: "half" },
      { id: "super_lic", label: "License #", type: "text", width: "half" },
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

// Public: fetch an RFI by access token (no auth required - uses service role via edge function)
export function useRfiByToken(token: string | null) {
  return useQuery({
    queryKey: ["rfi-public", token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from("rfi_requests" as any)
        .select("*")
        .eq("access_token", token)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RfiRequest | null;
    },
    enabled: !!token,
  });
}
