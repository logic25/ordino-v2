import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type {
  MockService, MockContact, MockMilestone,
  MockDocument, MockTimeEntry, MockChecklistItem, MockPISStatus,
} from "@/components/projects/projectMockData";
import { OPTIONAL_PIS_FIELD_IDS, EXCLUDED_PIS_SECTION_IDS } from "@/components/projects/EditPISDialog";

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
        needsDobFiling: svc.needs_dob_filing ?? false,
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

      // 1. Client contacts (from the project's own client)
      if (clientId) {
        const { data: clientContacts } = await supabase
          .from("client_contacts")
          .select("id, name, email, phone, title, company_name, is_primary, first_name, last_name, client_id")
          .eq("client_id", clientId)
          .order("is_primary", { ascending: false });

        (clientContacts || []).forEach((cc: any) => {
          const key = cc.id;
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
            client_id: cc.client_id,
            first_name: cc.first_name || "",
            last_name: cc.last_name || "",
            title: cc.title || "",
            is_primary: cc.is_primary || false,
          });
        });
      }

      // 2. Explicitly linked contacts (from project_contacts join table)
      const { data: linkedRows } = await (supabase.from("project_contacts" as any) as any)
        .select("contact_id")
        .eq("project_id", projectId);

      if (linkedRows?.length) {
        const linkedIds = (linkedRows as any[]).map((r: any) => r.contact_id).filter((id: string) => !seen.has(id));
        if (linkedIds.length) {
          const { data: linkedContacts } = await supabase
            .from("client_contacts")
            .select("id, name, email, phone, title, company_name, is_primary, first_name, last_name, client_id")
            .in("id", linkedIds);

          (linkedContacts || []).forEach((cc: any) => {
            if (seen.has(cc.id)) return;
            seen.add(cc.id);
            contacts.push({
              id: cc.id,
              name: cc.name,
              role: cc.title || "Contact",
              company: cc.company_name || "",
              phone: cc.phone || "",
              email: cc.email || "",
              dobRole: "other",
              source: "manual",
              dobRegistered: "unknown",
              client_id: cc.client_id,
              first_name: cc.first_name || "",
              last_name: cc.last_name || "",
              title: cc.title || "",
              is_primary: cc.is_primary || false,
            });
          });
        }
      }

      // 3. Proposal contacts
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
        .select("id, status, created_at, sections, responses, submitted_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!rfi) {
        return { sentDate: null, totalFields: 0, completedFields: 0, missingFields: [] };
      }

      const sections = (rfi.sections as any[]) || [];
      const responses = (rfi.responses as Record<string, any>) || {};

      // Helper: resolve a response value by trying prefixed and flat keys
      const getResponseVal = (sectionId: string, fieldId: string) => {
        return responses[`${sectionId}_${fieldId}`] ?? responses[fieldId];
      };

      // Determine which GC/TPP/SIA detail fields should be excluded
      // based on the _same_as checkbox or whether details are filled
      const conditionallyExcludedIds = new Set<string>();

      // GC: check if "same as applicant" is checked or if details are filled
      const gcSameAs = getResponseVal("contractors_inspections", "gc_same_as");
      const gcHasDetails = !!(getResponseVal("contractors_inspections", "gc_name"));
      const gcFieldIds = ["gc_name", "gc_company", "gc_phone", "gc_email", "gc_address", "gc_dob_tracking", "gc_hic_lic"];

      // TPP: check if "same as applicant" is checked or if details are filled
      const tppSameAs = getResponseVal("contractors_inspections", "tpp_same_as");
      const tppHasDetails = !!(getResponseVal("contractors_inspections", "tpp_name"));
      const tppFieldIds = ["tpp_name", "tpp_email"];

      // SIA: check if "same as applicant" is checked or if details are filled
      const siaSameAs = getResponseVal("contractors_inspections", "sia_same_as");
      const siaHasDetails = !!(getResponseVal("contractors_inspections", "sia_name"));
      const siaFieldIds = ["sia_name", "sia_company", "sia_phone", "sia_email", "sia_number", "sia_nys_lic"];

      // If same_as is checked OR details are not filled, exclude detail fields from individual counting
      if (gcSameAs || !gcHasDetails) {
        gcFieldIds.forEach(id => conditionallyExcludedIds.add(id));
      }
      if (tppSameAs || !tppHasDetails) {
        tppFieldIds.forEach(id => conditionallyExcludedIds.add(id));
      }
      if (siaSameAs || !siaHasDetails) {
        siaFieldIds.forEach(id => conditionallyExcludedIds.add(id));
      }

      // The _same_as checkboxes themselves are UI toggles, not data fields
      const gatingFieldIds = new Set(["gc_same_as", "tpp_same_as", "sia_same_as", "gc_known", "tpp_known", "sia_known"]);

      // Collect all individual fields from section definitions
      // Exclude optional fields, gating questions, conditional fields, and excluded sections
      const allFields: { id: string; label: string; sectionId: string }[] = [];
      for (const section of sections) {
        if (EXCLUDED_PIS_SECTION_IDS.has(section.id)) continue;
        const fields = (section.fields as any[]) || [];
        for (const field of fields) {
          if (field.type === "heading" || field.type === "file_upload" || field.type === "work_type_picker" || field.type === "checkbox_group") continue;
          const fieldId = field.id as string;
          if (OPTIONAL_PIS_FIELD_IDS.has(fieldId)) continue;
          if (gatingFieldIds.has(fieldId)) continue;
          if (conditionallyExcludedIds.has(fieldId)) continue;
          allFields.push({ id: fieldId, label: field.label || fieldId, sectionId: section.id });
        }
      }

      const totalFields = allFields.length || 7;

      // Check which fields have responses (try both flat and prefixed keys)
      const completedFields = allFields.filter(f => {
        const flatVal = responses[f.id];
        const prefixedVal = responses[`${f.sectionId}_${f.id}`];
        const val = prefixedVal ?? flatVal;
        if (val === null || val === undefined || val === "") return false;
        if (Array.isArray(val)) return val.length > 0;
        return String(val).trim().length > 0;
      }).length;

      const missingFields = allFields
        .filter(f => {
          const flatVal = responses[f.id];
          const prefixedVal = responses[`${f.sectionId}_${f.id}`];
          const val = prefixedVal ?? flatVal;
          if (val === null || val === undefined || val === "") return true;
          if (Array.isArray(val)) return val.length === 0;
          return String(val).trim().length === 0;
        })
        .map(f => f.label);

      // Append grouped TBD labels for unknown contractors
      // "Same as Applicant" checked = resolved, not missing
      if (!gcSameAs && !gcHasDetails) {
        missingFields.push("General Contractor (TBD)");
      }
      if (!tppSameAs && !tppHasDetails) {
        missingFields.push("TPP Applicant (TBD)");
      }
      if (!siaSameAs && !siaHasDetails) {
        missingFields.push("Special Inspector (TBD)");
      }

      return {
        sentDate: format(new Date(rfi.created_at), "MM/dd/yyyy"),
        totalFields,
        completedFields,
        missingFields,
      };
    },
    enabled: !!projectId,
  });
}

export function useProjectDocuments(projectId: string | undefined, proposalId?: string | null) {
  return useQuery({
    queryKey: ["project-documents", projectId, proposalId],
    queryFn: async () => {
      if (!projectId) return [];

      const docs: MockDocument[] = [];

      // 1. Universal documents
      const { data, error } = await (supabase
        .from("universal_documents") as any)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        data.forEach((doc: any) => {
          // Resolve correct storage bucket based on path prefix
          let bucket = "universal-documents";
          if (doc.storage_path?.startsWith("proposals/")) {
            bucket = "documents";
          }
          docs.push({
            id: doc.id,
            name: doc.title || doc.filename,
            type: doc.mime_type === "application/pdf" ? "PDF" : (doc.mime_type || "File").split("/").pop()?.toUpperCase() || "File",
            category: doc.category || "other",
            size: doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : "—",
            uploadedBy: "System",
            uploadedDate: format(new Date(doc.created_at), "MM/dd/yyyy"),
            storage_path: doc.storage_path,
            filename: doc.filename,
            storageBucket: bucket,
          });
        });
      }

      // 2. PIS attachments from rfi_requests responses
      const { data: rfis } = await (supabase.from("rfi_requests") as any)
        .select("id, responses, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rfis?.responses) {
        const resp = rfis.responses as Record<string, any>;
        // Look for file upload fields (arrays of {name, path})
        for (const [key, val] of Object.entries(resp)) {
          if (Array.isArray(val)) {
            val.forEach((file: any) => {
              if (file && typeof file === "object" && file.path && file.name) {
                docs.push({
                  id: `pis-${rfis.id}-${file.name}`,
                  name: file.name,
                  type: file.name.split(".").pop()?.toUpperCase() || "File",
                  category: "plans",
                  size: "—",
                  uploadedBy: "PIS Submission",
                  uploadedDate: format(new Date(rfis.created_at), "MM/dd/yyyy"),
                  storage_path: file.path,
                  filename: file.name,
                  storageBucket: "rfi-attachments",
                });
              }
            });
          }
        }
      }

      // 3. Inject signed proposal if it exists in storage
      if (proposalId) {
        const signedPath = `proposals/${proposalId}/signed_proposal.html`;
        const alreadyHasSignedProposal = docs.some(d => d.storage_path === signedPath || d.category === "contract");
        if (!alreadyHasSignedProposal) {
          // Check if the file actually exists in storage
          const { data: fileList } = await supabase.storage
            .from("documents")
            .list(`proposals/${proposalId}`, { limit: 10 });
          const signedFile = fileList?.find(f => f.name === "signed_proposal.html");
          if (signedFile) {
            docs.unshift({
              id: `signed-proposal-${proposalId}`,
              name: "Signed Proposal",
              type: "HTML",
              category: "contract",
              size: signedFile.metadata?.size ? `${Math.round(signedFile.metadata.size / 1024)} KB` : "—",
              uploadedBy: "System",
              uploadedDate: signedFile.created_at ? format(new Date(signedFile.created_at), "MM/dd/yyyy") : "—",
              storage_path: signedPath,
              filename: "signed_proposal.html",
              storageBucket: "documents",
            });
          }
        }
      }

      return docs;
    },
    enabled: !!projectId,
  });
}
