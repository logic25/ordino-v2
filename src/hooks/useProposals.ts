import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Proposal = Tables<"proposals">;
export type ProposalItem = Tables<"proposal_items">;
export type ProposalMilestone = Tables<"proposal_milestones">;

export type ProposalWithRelations = Proposal & {
  properties?: Tables<"properties"> | null;
  items?: ProposalItem[];
  milestones?: ProposalMilestone[];
  internal_signer?: Tables<"profiles"> | null;
  assigned_pm?: Tables<"profiles"> | null;
  sales_person?: Tables<"profiles"> | null;
  creator?: Tables<"profiles"> | null;
};

export interface ProposalFormInput {
  property_id: string;
  title: string;
  scope_of_work?: string | null;
  payment_terms?: string | null;
  deposit_required?: number | null;
  deposit_percentage?: number | null;
  tax_rate?: number | null;
  valid_until?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_id?: string | null;
  assigned_pm_id?: string | null;
  notes?: string | null;
  lead_source?: string | null;
  referred_by?: string | null;
  project_type?: string | null;
  sales_person_id?: string | null;
  billed_to_name?: string | null;
  billed_to_email?: string | null;
  reminder_date?: string | null;
  terms_conditions?: string | null;
  retainer_amount?: number | null;
  // Party info
  architect_company?: string | null;
  architect_name?: string | null;
  architect_phone?: string | null;
  architect_email?: string | null;
  architect_license_type?: string | null;
  architect_license_number?: string | null;
  gc_company?: string | null;
  gc_name?: string | null;
  gc_phone?: string | null;
  gc_email?: string | null;
  sia_name?: string | null;
  sia_company?: string | null;
  sia_phone?: string | null;
  sia_email?: string | null;
  tpp_name?: string | null;
  tpp_email?: string | null;
  job_description?: string | null;
  items?: ProposalItemInput[];
  milestones?: ProposalMilestoneInput[];
}

export interface ProposalItemInput {
  id?: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  sort_order?: number;
  fee_type?: string | null;
  estimated_hours?: number | null;
  discount_percent?: number | null;
  is_optional?: boolean;
  disciplines?: string[] | null;
  discipline_fee?: number | null;
}

export interface ProposalMilestoneInput {
  id?: string;
  name: string;
  description?: string | null;
  percentage?: number | null;
  amount?: number | null;
  due_date?: string | null;
  sort_order?: number;
}

export function useProposals() {
  return useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(`
          *,
          properties (id, address, borough),
          internal_signer:profiles!proposals_internal_signed_by_fkey (id, first_name, last_name),
          assigned_pm:profiles!proposals_assigned_pm_id_fkey (id, first_name, last_name),
          sales_person:profiles!proposals_sales_person_id_fkey (id, first_name, last_name),
          creator:profiles!proposals_created_by_fkey (id, first_name, last_name),
          converted_project:projects!proposals_converted_project_id_fkey (id, project_number)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as unknown as ProposalWithRelations[];
    },
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ["proposals", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .select(`
          *,
          properties (id, address, borough, owner_name, owner_contact),
          internal_signer:profiles!proposals_internal_signed_by_fkey (id, first_name, last_name),
          assigned_pm:profiles!proposals_assigned_pm_id_fkey (id, first_name, last_name)
        `)
        .eq("id", id)
        .maybeSingle();
      
      if (proposalError) throw proposalError;
      if (!proposal) return null;

      const { data: items } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", id)
        .order("sort_order");

      const { data: milestones } = await supabase
        .from("proposal_milestones")
        .select("*")
        .eq("proposal_id", id)
        .order("sort_order");

      return {
        ...proposal,
        items: items || [],
        milestones: milestones || [],
      } as ProposalWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProposalFormInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) {
        throw new Error("No company found for user");
      }

      const { items, milestones, ...proposalData } = input;
      
      // Calculate totals
      const subtotal = items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
      const taxRate = input.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      // Get current user's profile id for created_by
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .insert({
          company_id: profile.company_id,
          property_id: proposalData.property_id,
          title: proposalData.title,
          scope_of_work: proposalData.scope_of_work || null,
          payment_terms: proposalData.payment_terms || null,
          deposit_required: proposalData.deposit_required || 0,
          deposit_percentage: proposalData.deposit_percentage || null,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          subtotal: subtotal,
          total_amount: totalAmount,
          valid_until: proposalData.valid_until || null,
          client_name: proposalData.client_name || null,
          client_email: proposalData.client_email || null,
          client_id: proposalData.client_id || null,
          notes: proposalData.notes || null,
          terms_conditions: proposalData.terms_conditions || null,
          lead_source: proposalData.lead_source || null,
          project_type: proposalData.project_type || null,
          sales_person_id: proposalData.sales_person_id || null,
          assigned_pm_id: proposalData.assigned_pm_id || null,
          created_by: profile.id,
          billed_to_name: proposalData.billed_to_name || null,
          billed_to_email: proposalData.billed_to_email || null,
          reminder_date: proposalData.reminder_date || null,
          retainer_amount: proposalData.retainer_amount || 0,
          architect_company: proposalData.architect_company || null,
          architect_name: proposalData.architect_name || null,
          architect_phone: proposalData.architect_phone || null,
          architect_email: proposalData.architect_email || null,
          architect_license_type: proposalData.architect_license_type || null,
          architect_license_number: proposalData.architect_license_number || null,
          gc_company: proposalData.gc_company || null,
          gc_name: proposalData.gc_name || null,
          gc_phone: proposalData.gc_phone || null,
          gc_email: proposalData.gc_email || null,
          sia_name: proposalData.sia_name || null,
          sia_company: proposalData.sia_company || null,
          sia_phone: proposalData.sia_phone || null,
          sia_email: proposalData.sia_email || null,
          tpp_name: proposalData.tpp_name || null,
          tpp_email: proposalData.tpp_email || null,
          job_description: proposalData.job_description || null,
        } as any)
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Insert items
      if (items && items.length > 0) {
        const itemsToInsert = items.map((item, idx) => ({
          proposal_id: proposal.id,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          sort_order: item.sort_order ?? idx,
          fee_type: item.fee_type || "fixed",
          estimated_hours: item.estimated_hours || null,
          discount_percent: item.discount_percent || null,
          is_optional: item.is_optional || false,
          disciplines: item.disciplines || null,
          discipline_fee: item.discipline_fee || null,
        }));

        const { error: itemsError } = await supabase
          .from("proposal_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Insert milestones
      if (milestones && milestones.length > 0) {
        const milestonesToInsert = milestones.map((m, idx) => ({
          proposal_id: proposal.id,
          name: m.name,
          description: m.description || null,
          percentage: m.percentage || null,
          amount: m.amount || (m.percentage ? totalAmount * (m.percentage / 100) : null),
          due_date: m.due_date || null,
          sort_order: m.sort_order ?? idx,
        }));

        const { error: milestonesError } = await supabase
          .from("proposal_milestones")
          .insert(milestonesToInsert);

        if (milestonesError) throw milestonesError;
      }

      return proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ProposalFormInput & { id: string }) => {
      const { items, milestones, ...proposalData } = input;
      
      // Calculate totals
      const subtotal = items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
      const taxRate = input.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .update({
          property_id: proposalData.property_id,
          title: proposalData.title,
          scope_of_work: proposalData.scope_of_work || null,
          payment_terms: proposalData.payment_terms || null,
          deposit_required: proposalData.deposit_required || 0,
          deposit_percentage: proposalData.deposit_percentage || null,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          subtotal: subtotal,
          total_amount: totalAmount,
          valid_until: proposalData.valid_until || null,
          client_name: proposalData.client_name || null,
          client_email: proposalData.client_email || null,
          client_id: proposalData.client_id || null,
          notes: proposalData.notes || null,
          terms_conditions: proposalData.terms_conditions || null,
          lead_source: proposalData.lead_source || null,
          project_type: proposalData.project_type || null,
          sales_person_id: proposalData.sales_person_id || null,
          assigned_pm_id: proposalData.assigned_pm_id || null,
          billed_to_name: proposalData.billed_to_name || null,
          billed_to_email: proposalData.billed_to_email || null,
          reminder_date: proposalData.reminder_date || null,
          retainer_amount: proposalData.retainer_amount || 0,
          architect_company: proposalData.architect_company || null,
          architect_name: proposalData.architect_name || null,
          architect_phone: proposalData.architect_phone || null,
          architect_email: proposalData.architect_email || null,
          architect_license_type: proposalData.architect_license_type || null,
          architect_license_number: proposalData.architect_license_number || null,
          gc_company: proposalData.gc_company || null,
          gc_name: proposalData.gc_name || null,
          gc_phone: proposalData.gc_phone || null,
          gc_email: proposalData.gc_email || null,
          sia_name: proposalData.sia_name || null,
          sia_company: proposalData.sia_company || null,
          sia_phone: proposalData.sia_phone || null,
          sia_email: proposalData.sia_email || null,
          tpp_name: proposalData.tpp_name || null,
          tpp_email: proposalData.tpp_email || null,
          job_description: proposalData.job_description || null,
        } as any)
        .eq("id", id)
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Delete existing items and milestones, then re-insert
      await supabase.from("proposal_items").delete().eq("proposal_id", id);
      await supabase.from("proposal_milestones").delete().eq("proposal_id", id);

      // Insert items
      if (items && items.length > 0) {
        const itemsToInsert = items.map((item, idx) => ({
          proposal_id: id,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
          sort_order: item.sort_order ?? idx,
          fee_type: item.fee_type || "fixed",
          estimated_hours: item.estimated_hours || null,
          discount_percent: item.discount_percent || null,
          is_optional: item.is_optional || false,
          disciplines: item.disciplines || null,
          discipline_fee: item.discipline_fee || null,
        }));

        await supabase.from("proposal_items").insert(itemsToInsert);
      }

      // Insert milestones
      if (milestones && milestones.length > 0) {
        const milestonesToInsert = milestones.map((m, idx) => ({
          proposal_id: id,
          name: m.name,
          description: m.description || null,
          percentage: m.percentage || null,
          amount: m.amount || (m.percentage ? totalAmount * (m.percentage / 100) : null),
          due_date: m.due_date || null,
          sort_order: m.sort_order ?? idx,
        }));

        await supabase.from("proposal_milestones").insert(milestonesToInsert);
      }

      return proposal;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals", data.id] });
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("proposals")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });
}

export function useSendProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Send only updates sent_at — status is managed by sign flow
      const updatePayload: Record<string, any> = {
        sent_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("proposals")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals", data.id] });
    },
  });
}

export function useSignProposalInternal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, signatureData, assignedPmId }: { 
      id: string; 
      signatureData: string;
      assignedPmId: string;
    }) => {
      // Get current user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Get proposal with items
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .select("*, items:proposal_items(*), properties(address)")
        .eq("id", id)
        .single();

      if (proposalError) throw proposalError;

      // Create a Project (not a DOB application directly)
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          company_id: profile.company_id,
          property_id: proposal.property_id,
          proposal_id: proposal.id,
          name: proposal.title,
          assigned_pm_id: assignedPmId,
          client_id: proposal.client_id || null,
          retainer_amount: (proposal as any).retainer_amount || 0,
          retainer_balance: (proposal as any).retainer_amount || 0,
          status: "open",
          created_by: profile.id,
          notes: `Created from proposal ${proposal.proposal_number}`,
          // Carry forward party info from proposal
          architect_company_name: (proposal as any).architect_company || null,
          architect_contact_name: (proposal as any).architect_name || null,
          architect_phone: (proposal as any).architect_phone || null,
          architect_email: (proposal as any).architect_email || null,
          architect_license_type: (proposal as any).architect_license_type || null,
          architect_license_number: (proposal as any).architect_license_number || null,
          gc_company_name: (proposal as any).gc_company || null,
          gc_contact_name: (proposal as any).gc_name || null,
          gc_phone: (proposal as any).gc_phone || null,
          gc_email: (proposal as any).gc_email || null,
          sia_name: (proposal as any).sia_name || null,
          sia_company: (proposal as any).sia_company || null,
          sia_phone: (proposal as any).sia_phone || null,
          sia_email: (proposal as any).sia_email || null,
          tpp_name: (proposal as any).tpp_name || null,
          tpp_email: (proposal as any).tpp_email || null,
        } as any)
        .select()
        .single();

      if (projectError) throw projectError;

      // Create services from proposal items, linked to the project
      const items = (proposal as any).items || [];
      if (items.length > 0) {
        const servicesToInsert = items.map((item: any) => ({
          company_id: profile.company_id,
          application_id: (project as any).id, // Still requires application_id due to NOT NULL — we'll create a placeholder
          project_id: (project as any).id,
          name: item.name,
          description: item.description,
          estimated_hours: item.estimated_hours || null,
          fixed_price: item.total_price,
          total_amount: item.total_price,
          billing_type: "fixed",
          status: "not_started",
        }));

        // We need a DOB application to satisfy the FK constraint on services
        const { data: application, error: appError } = await supabase
          .from("dob_applications")
          .insert({
            company_id: profile.company_id,
            property_id: proposal.property_id,
            assigned_pm_id: assignedPmId,
            project_id: (project as any).id,
            status: "draft",
            description: proposal.title,
            estimated_value: proposal.total_amount,
            notes: `Auto-created from proposal ${proposal.proposal_number}`,
          } as any)
          .select()
          .single();

        if (appError) {
          console.error("Error creating application:", appError);
        } else {
          // Now insert services linked to application
          const servicesWithApp = servicesToInsert.map((s: any) => ({
            ...s,
            application_id: application.id,
          }));

          const { error: servicesError } = await supabase
            .from("services")
            .insert(servicesWithApp);

          if (servicesError) {
            console.error("Error creating services:", servicesError);
          }
        }
      }

      // Update proposal with signature and link to project
      const { data, error } = await supabase
        .from("proposals")
        .update({
          status: "sent",
          internal_signed_by: profile.id,
          internal_signed_at: new Date().toISOString(),
          internal_signature_data: signatureData,
          assigned_pm_id: assignedPmId,
          converted_project_id: (project as any).id,
          converted_at: new Date().toISOString(),
        } as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Create notification for assigned PM
      if (assignedPmId && assignedPmId !== profile.id) {
        const propertyAddress = (proposal as any).properties?.address || "Unknown address";
        await supabase.from("notifications").insert({
          company_id: profile.company_id,
          user_id: assignedPmId,
          type: "project_assigned",
          title: `New project assigned: ${proposal.title}`,
          body: `Project at ${propertyAddress} has been created from proposal ${proposal.proposal_number}. Review the project details and send a PIS to the client.`,
          link: `/projects/${(project as any).id}`,
          project_id: (project as any).id,
        } as any);
      }

      // Auto-create welcome RFI linked to proposal so client portal PIS link works
      try {
        // Fetch the default PIS template
        const { data: template } = await supabase
          .from("rfi_templates")
          .select("id, sections")
          .limit(1)
          .maybeSingle();

        const rfiSections = template?.sections || [];

        await (supabase.from("rfi_requests") as any).insert({
          company_id: profile.company_id,
          template_id: template?.id || null,
          project_id: (project as any).id,
          proposal_id: id,
          property_id: proposal.property_id,
          title: `Project Information Sheet – ${(proposal as any).properties?.address || proposal.title}`,
          recipient_name: (proposal as any).client_name || null,
          recipient_email: null,
          sections: rfiSections,
          created_by: profile.id,
          status: "sent",
        });
      } catch (rfiErr) {
        console.error("Error creating welcome RFI:", rfiErr);
      }

      // Save signed proposal as a project document reference
      try {
        await supabase.from("universal_documents").insert({
          company_id: profile.company_id,
          title: `Signed Proposal – ${proposal.proposal_number || proposal.title}`,
          description: `Internally signed proposal contract for ${(proposal as any).properties?.address || proposal.title}`,
          category: "contract",
          filename: `Proposal_${proposal.proposal_number || "draft"}_signed.pdf`,
          storage_path: `proposals/${id}/signed`,
          mime_type: "application/pdf",
          uploaded_by: profile.id,
          project_id: (project as any).id,
          property_id: proposal.property_id,
          tags: ["proposal", "signed", "contract"],
        } as any);
      } catch (docErr) {
        console.error("Error saving proposal document reference:", docErr);
      }

      return { proposal: data, project };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals", data.proposal.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}
