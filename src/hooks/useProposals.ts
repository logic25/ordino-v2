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
  assigned_pm_id?: string | null;
  notes?: string | null;
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
          assigned_pm:profiles!proposals_assigned_pm_id_fkey (id, first_name, last_name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as ProposalWithRelations[];
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
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
          notes: proposalData.notes || null,
        })
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
          notes: proposalData.notes || null,
        })
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
      const { data, error } = await supabase
        .from("proposals")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("Profile not found");

      // Get proposal with items
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .select("*, items:proposal_items(*)")
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
          status: "open",
          created_by: profile.id,
          notes: `Created from proposal ${proposal.proposal_number}`,
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
          status: "signed_internal",
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
