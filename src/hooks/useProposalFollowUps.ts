import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PIS_SECTIONS } from "@/hooks/useRfi";

export interface ProposalFollowUp {
  id: string;
  proposal_id: string;
  company_id: string;
  action: string;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export function useProposalsNeedingFollowUp() {
  return useQuery({
    queryKey: ["proposals-needing-followup"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("proposals")
        .select(`
          *,
          properties (id, address, borough),
          assigned_pm:profiles!proposals_assigned_pm_id_fkey (id, first_name, last_name),
          creator:profiles!proposals_created_by_fkey (id, first_name, last_name),
          sales_person:profiles!proposals_sales_person_id_fkey (id, first_name, last_name)
        `)
        .lte("next_follow_up_date", today)
        .is("follow_up_dismissed_at", null)
        .in("status", ["sent", "viewed"])
        .order("next_follow_up_date", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
  });
}

export function useProposalFollowUpLog(proposalId: string | undefined) {
  return useQuery({
    queryKey: ["proposal-follow-ups", proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      const { data, error } = await supabase
        .from("proposal_follow_ups")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProposalFollowUp[];
    },
    enabled: !!proposalId,
  });
}

export function useMarkProposalApproved() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      approvalMethod,
      signedDocumentUrl,
      notes,
      assignedPmId,
    }: {
      id: string;
      approvalMethod: string;
      signedDocumentUrl?: string;
      notes?: string;
      assignedPmId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Fetch proposal with items to create project
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .select("*, items:proposal_items(*), properties(address)")
        .eq("id", id)
        .single();

      if (proposalError) throw proposalError;

      // Check if project already exists for this proposal
      const existingProjectId = (proposal as any).converted_project_id;

      let projectId = existingProjectId;

      if (!existingProjectId) {
        // Create project (same logic as useSignProposalInternal)
        const pmId = assignedPmId || (proposal as any).assigned_pm_id || profile.id;

        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            company_id: profile.company_id,
            property_id: proposal.property_id,
            proposal_id: proposal.id,
            name: proposal.title,
            assigned_pm_id: pmId,
            client_id: proposal.client_id || null,
            retainer_amount: (proposal as any).retainer_amount || 0,
            retainer_balance: (proposal as any).retainer_amount || 0,
            status: "open",
            created_by: profile.id,
            notes: `Created from proposal ${proposal.proposal_number} (approved via ${approvalMethod.replace(/_/g, " ")})`,
            // Carry forward party info
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
        projectId = (project as any).id;

        // Create services from proposal items
        const items = (proposal as any).items || [];
        if (items.length > 0) {
          // Create DOB application placeholder for FK constraint
          const { data: application } = await supabase
            .from("dob_applications")
            .insert({
              company_id: profile.company_id,
              property_id: proposal.property_id,
              assigned_pm_id: pmId,
              project_id: projectId,
              status: "draft",
              description: proposal.title,
              estimated_value: proposal.total_amount,
              notes: `Auto-created from proposal ${proposal.proposal_number}`,
            } as any)
            .select()
            .single();

          if (application) {
            const servicesData = items.map((item: any) => ({
              company_id: profile.company_id,
              application_id: application.id,
              project_id: projectId,
              name: item.name,
              description: item.description,
              estimated_hours: item.estimated_hours || null,
              fixed_price: item.total_price,
              total_amount: item.total_price,
              billing_type: "fixed",
              status: "not_started",
              needs_dob_filing: item.needs_dob_filing ?? false,
            }));

            await supabase.from("services").insert(servicesData);
          }
        }

        // Create notification for assigned PM
        if (pmId && pmId !== profile.id) {
          const propertyAddress = (proposal as any).properties?.address || "Unknown address";
          await supabase.from("notifications").insert({
            company_id: profile.company_id,
            user_id: pmId,
            type: "project_assigned",
            title: `New project assigned: ${proposal.title}`,
            body: `Project at ${propertyAddress} has been created from proposal ${proposal.proposal_number}. Review the project details and send a PIS to the client.`,
            link: `/projects/${projectId}`,
            project_id: projectId,
          } as any);
        }

        // Auto-create welcome RFI
        try {
          const { data: template } = await supabase
            .from("rfi_templates")
            .select("id, sections")
            .limit(1)
            .maybeSingle();

          await (supabase.from("rfi_requests") as any).insert({
            company_id: profile.company_id,
            template_id: template?.id || null,
            project_id: projectId,
            proposal_id: id,
            property_id: proposal.property_id,
            title: `Project Information Sheet – ${(proposal as any).properties?.address || proposal.title}`,
            recipient_name: (proposal as any).client_name || null,
            recipient_email: null,
            sections: (template?.sections && Array.isArray(template.sections) && (template.sections as any[]).length > 0) ? template.sections : DEFAULT_PIS_SECTIONS,
            created_by: profile.id,
            status: "sent",
          });
        } catch (rfiErr) {
          console.error("Error creating welcome RFI:", rfiErr);
        }
      }

      // Update proposal status + link to project
      const { error } = await supabase
        .from("proposals")
        .update({
          status: "executed",
          approval_method: approvalMethod,
          signed_document_url: signedDocumentUrl || null,
          next_follow_up_date: null,
          follow_up_dismissed_at: null,
          converted_project_id: projectId,
          converted_at: new Date().toISOString(),
        } as any)
        .eq("id", id);

      if (error) throw error;

      // Log the activity
      await supabase.from("proposal_follow_ups").insert({
        proposal_id: id,
        company_id: profile.company_id,
        action: "approved",
        notes: notes || `Approved via ${approvalMethod.replace("_", " ")}`,
        performed_by: profile.id,
      } as any);

      return { projectId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals-needing-followup"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useDismissFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase
        .from("proposals")
        .update({
          follow_up_dismissed_at: new Date().toISOString(),
          follow_up_dismissed_by: profile.id,
        } as any)
        .eq("id", id);

      if (error) throw error;

      await supabase.from("proposal_follow_ups").insert({
        proposal_id: id,
        company_id: profile.company_id,
        action: "dismissed",
        notes: notes || "Follow-up dismissed",
        performed_by: profile.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals-needing-followup"] });
    },
  });
}

export function useLogFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      action,
      notes,
    }: {
      proposalId: string;
      action: string;
      notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("Profile not found");

      // Log activity
      await supabase.from("proposal_follow_ups").insert({
        proposal_id: proposalId,
        company_id: profile.company_id,
        action,
        notes,
        performed_by: profile.id,
      } as any);

      // Bump next follow-up date and count
      const { data: proposal } = await supabase
        .from("proposals")
        .select("follow_up_interval_days, follow_up_count")
        .eq("id", proposalId)
        .single();

      const interval = (proposal as any)?.follow_up_interval_days || 7;
      const count = ((proposal as any)?.follow_up_count || 0) + 1;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + interval);

      await supabase
        .from("proposals")
        .update({
          follow_up_count: count,
          last_follow_up_at: new Date().toISOString(),
          next_follow_up_date: nextDate.toISOString().split("T")[0],
          follow_up_dismissed_at: null,
        } as any)
        .eq("id", proposalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals-needing-followup"] });
      queryClient.invalidateQueries({ queryKey: ["proposal-follow-ups"] });
    },
  });
}

export function useSnoozeFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + days);

      const { error } = await supabase
        .from("proposals")
        .update({
          next_follow_up_date: nextDate.toISOString().split("T")[0],
          follow_up_dismissed_at: null,
        } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals-needing-followup"] });
    },
  });
}
