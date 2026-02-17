import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type {
  MockService, MockContact, MockMilestone,
  MockDocument, MockTimeEntry, MockChecklistItem, MockPISStatus,
} from "@/components/projects/projectMockData";

export function useProjectServices(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-services", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map((svc: any): MockService => ({
        id: svc.id,
        name: svc.name || "Untitled Service",
        status: svc.status || "not_started",
        application: null, // Will be populated separately if needed
        subServices: svc.disciplines || [],
        totalAmount: svc.total_amount || svc.fixed_price || 0,
        billedAmount: svc.billed_amount || 0,
        costAmount: svc.cost_amount || 0,
        assignedTo: (svc as any).assigned_to_name || "Unassigned",
        estimatedBillDate: svc.estimated_bill_date
          ? format(new Date(svc.estimated_bill_date), "MM/dd/yyyy")
          : null,
        billedAt: svc.billed_at
          ? format(new Date(svc.billed_at), "MM/dd/yyyy")
          : null,
        scopeOfWork: svc.description || "",
        jobDescription: svc.job_description || undefined,
        estimatedCosts: undefined,
        notes: svc.notes || "",
        needsDobFiling: false,
        tasks: [],
        requirements: [],
        allottedHours: svc.estimated_hours || 0,
        parentServiceId: svc.parent_service_id || undefined,
      }));
    },
    enabled: !!projectId,
  });
}

export function useProjectContacts(projectId: string | undefined, clientId: string | null | undefined, proposalId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-contacts", projectId, clientId, proposalId],
    queryFn: async () => {
      if (!projectId) return [];

      const contacts: MockContact[] = [];
      const seen = new Set<string>();

      // 1. Client contacts
      if (clientId) {
        const { data: clientContacts } = await supabase
          .from("client_contacts")
          .select("id, name, email, phone, title, company_name, is_primary")
          .eq("client_id", clientId)
          .order("is_primary", { ascending: false });

        (clientContacts || []).forEach((cc: any) => {
          const key = (cc.email || cc.name).toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          contacts.push({
            id: cc.id,
            name: cc.name,
            role: cc.title || (cc.is_primary ? "Primary Contact" : "Contact"),
            company: cc.company_name || "",
            phone: cc.phone || "",
            email: cc.email || "",
            dobRole: "owner",
            source: "proposal",
            dobRegistered: "unknown",
          });
        });
      }

      // 2. Proposal contacts
      if (proposalId) {
        const { data: propContacts } = await (supabase.from("proposal_contacts" as any) as any)
          .select("id, name, email, phone, company_name, role")
          .eq("proposal_id", proposalId)
          .order("sort_order");

        (propContacts || []).forEach((pc: any) => {
          const key = (pc.email || pc.name).toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          contacts.push({
            id: pc.id,
            name: pc.name,
            role: pc.role === "bill_to" ? "Bill To" : pc.role === "sign" ? "Signer" : pc.role === "cc" ? "CC" : pc.role,
            company: pc.company_name || "",
            phone: pc.phone || "",
            email: pc.email || "",
            dobRole: "other",
            source: "proposal",
            dobRegistered: "unknown",
          });
        });
      }

      return contacts;
    },
    enabled: !!projectId,
  });
}

export function useProjectTimeline(projectId: string | undefined, proposalId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-timeline", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const milestones: MockMilestone[] = [];

      // Get project creation date
      const { data: project } = await supabase
        .from("projects")
        .select("created_at, proposals!projects_proposal_id_fkey(proposal_number, internal_signed_at, client_signed_at, sent_at)")
        .eq("id", projectId)
        .single();

      if (project) {
        milestones.push({
          id: "m-created",
          date: format(new Date(project.created_at), "MM/dd/yyyy"),
          event: `Project created${(project as any).proposals?.proposal_number ? ` from Proposal #${(project as any).proposals.proposal_number}` : ""}`,
          source: "system",
        });

        const proposal = (project as any).proposals;
        if (proposal?.internal_signed_at) {
          milestones.push({
            id: "m-internal-sign",
            date: format(new Date(proposal.internal_signed_at), "MM/dd/yyyy"),
            event: "Proposal signed internally",
            source: "system",
          });
        }
        if (proposal?.client_signed_at) {
          milestones.push({
            id: "m-client-sign",
            date: format(new Date(proposal.client_signed_at), "MM/dd/yyyy"),
            event: "Proposal counter-signed by client",
            source: "system",
          });
        }
      }

      // Get RFI/PIS events
      const { data: rfis } = await (supabase.from("rfi_requests") as any)
        .select("id, title, status, created_at, submitted_at")
        .eq("project_id", projectId)
        .order("created_at");

      (rfis || []).forEach((rfi: any) => {
        milestones.push({
          id: `m-rfi-${rfi.id}`,
          date: format(new Date(rfi.created_at), "MM/dd/yyyy"),
          event: `${rfi.title || "PIS"} — ${rfi.status}`,
          source: "system",
        });
      });

      // Sort by date
      milestones.sort((a, b) => {
        const da = new Date(a.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2"));
        const db = new Date(b.date.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2"));
        return da.getTime() - db.getTime();
      });

      return milestones;
    },
    enabled: !!projectId,
  });
}

export function useProjectPISStatus(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-pis-status", projectId],
    queryFn: async (): Promise<MockPISStatus> => {
      if (!projectId) return { sentDate: null, totalFields: 0, completedFields: 0, missingFields: [] };

      const { data: rfi } = await (supabase.from("rfi_requests") as any)
        .select("id, status, created_at, sections, submitted_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!rfi) {
        return { sentDate: null, totalFields: 0, completedFields: 0, missingFields: [] };
      }

      const sections = (rfi.sections as any[]) || [];
      const totalFields = sections.length;
      const completedFields = sections.filter((s: any) => s.value || s.completed).length;
      const missingFields = sections
        .filter((s: any) => !s.value && !s.completed)
        .map((s: any) => s.label || s.title || "Unknown field");

      return {
        sentDate: format(new Date(rfi.created_at), "MM/dd/yyyy"),
        totalFields: totalFields || 7,
        completedFields,
        missingFields,
      };
    },
    enabled: !!projectId,
  });
}
