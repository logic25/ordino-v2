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
    queryKey: ["project-services-full", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const [{ data, error }, { data: billingReqs }] = await Promise.all([
        supabase
          .from("services")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
        supabase
          .from("billing_requests")
          .select("services")
          .eq("project_id", projectId)
          .in("status", ["pending", "invoiced"]),
      ]);

      if (error) throw error;

      // Build a map of service name -> total billed from billing_requests
      const billedMap: Record<string, number> = {};
      for (const br of billingReqs || []) {
        const items = (br.services as any[]) || [];
        for (const item of items) {
          const key = item.name || "";
          billedMap[key] = (billedMap[key] || 0) + (Number(item.amount) || Number(item.billed_amount) || 0);
        }
      }

      return (data || []).map((svc: any): MockService => ({
        id: svc.id,
        name: svc.name || "Untitled Service",
        status: svc.status || "not_started",
        application: null,
        subServices: svc.disciplines || [],
        totalAmount: Number(svc.total_amount ?? svc.fixed_price ?? 0) || 0,
        billedAmount: billedMap[svc.name] || Number(svc.billed_amount ?? 0) || 0,
        costAmount: Number(svc.cost_amount ?? 0) || 0,
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

      // Helper: resolve a response value by trying multiple key patterns
      const getResponseVal = (sectionId: string, fieldId: string) => {
        return responses[`${sectionId}_${fieldId}`] ?? responses[fieldId];
      };

      // Determine which GC/TPP/SIA detail fields should be excluded
      // based on the _same_as checkbox or whether details are filled
      const conditionallyExcludedIds = new Set<string>();

      // GC: check if "same as applicant" is checked or if details are filled
      const gcSameAs = getResponseVal("contractors_inspections", "gc_same_as") || getResponseVal("gc", "gc_same_as");
      const gcHasDetails = !!(getResponseVal("contractors_inspections", "gc_name") || getResponseVal("gc", "gc_name"));
      const gcFieldIds = ["gc_name", "gc_company", "gc_phone", "gc_email", "gc_address", "gc_dob_tracking", "gc_hic_lic"];

      // TPP: check if "same as applicant" is checked or if details are filled
      const tppSameAs = getResponseVal("contractors_inspections", "tpp_same_as") || getResponseVal("tpp", "tpp_same_as") || responses["tpp_same_as"];
      const tppHasDetails = !!(getResponseVal("contractors_inspections", "tpp_name") || getResponseVal("tpp", "tpp_name"));
      const tppFieldIds = ["tpp_name", "tpp_email", "rent_controlled", "rent_stabilized", "units_occupied"];

      // SIA: check if "same as applicant" is checked or if details are filled
      const siaSameAs = getResponseVal("contractors_inspections", "sia_same_as") || getResponseVal("sia", "sia_same_as") || responses["sia_same_as"];
      const siaHasDetails = !!(getResponseVal("contractors_inspections", "sia_name") || getResponseVal("sia", "sia_name"));
      const siaFieldIds = ["sia_name", "sia_company", "sia_phone", "sia_email", "sia_number", "sia_nys_lic"];

      // If same_as is checked OR details are not filled, exclude detail fields from individual counting
      if (gcSameAs || !gcHasDetails) {
        gcFieldIds.forEach(id => conditionallyExcludedIds.add(id));
      }
      // TPP: if same_as, keep rent/units fields visible (they still need answers); only exclude tpp_name/tpp_email
      // If TBD (no details, not same_as), exclude everything including rent/units
      const tppContactFieldIds = ["tpp_name", "tpp_email"];
      const tppExtraFieldIds = ["rent_controlled", "rent_stabilized", "units_occupied"];
      if (tppSameAs) {
        // Same as applicant: skip contact fields, but rent/units questions still required
        tppContactFieldIds.forEach(id => conditionallyExcludedIds.add(id));
      } else if (!tppHasDetails) {
        // TBD: exclude everything
        [...tppContactFieldIds, ...tppExtraFieldIds].forEach(id => conditionallyExcludedIds.add(id));
      }
      if (siaSameAs || !siaHasDetails) {
        siaFieldIds.forEach(id => conditionallyExcludedIds.add(id));
      }

      // The _same_as checkboxes themselves are UI toggles, not data fields
      const gatingFieldIds = new Set(["gc_same_as", "tpp_same_as", "sia_same_as", "gc_known", "tpp_known", "sia_known"]);

      // Collect all individual fields from section definitions
      // Exclude optional fields, gating questions, conditional fields, and excluded sections
      // Map of section id to a short prefix for disambiguating generic labels
      const sectionPrefixMap: Record<string, string> = {
        building_and_scope: "",
        applicant_owner: "",
        contractors_inspections: "",
      };
      const genericLabels = new Set(["Email", "Phone", "Full Name", "Company / Entity Name", "Address", "Name", "Business Name"]);
      // Derive a human-friendly prefix from the current heading context within each section
      const allFields: { id: string; label: string; sectionId: string }[] = [];
      for (const section of sections) {
        if (EXCLUDED_PIS_SECTION_IDS.has(section.id)) continue;
        const fields = (section.fields as any[]) || [];
        let currentHeading = sectionPrefixMap[section.id] ?? "";
        for (const field of fields) {
          if (field.type === "heading") {
            // Track the current heading so we can prefix generic fields
            currentHeading = (field.label as string || "").replace(/\s*\(.*\)/, "").trim();
            continue;
          }
          if (field.type === "file_upload" || field.type === "work_type_picker" || field.type === "checkbox_group") continue;
          const fieldId = field.id as string;
          if (OPTIONAL_PIS_FIELD_IDS.has(fieldId)) continue;
          if (gatingFieldIds.has(fieldId)) continue;
          if (conditionallyExcludedIds.has(fieldId)) continue;
          const rawLabel = field.label || fieldId;
          // Prefix generic labels with the current heading context for clarity
          const label = (genericLabels.has(rawLabel) && currentHeading) ? `${currentHeading} — ${rawLabel}` : rawLabel;
          allFields.push({ id: fieldId, label, sectionId: section.id });
        }
      }

      // Ensure filing_type is always tracked in readiness even if not in DB sections template
      const hasFilingType = allFields.some(f => f.id === "filing_type");
      if (!hasFilingType) {
        allFields.push({ id: "filing_type", label: "Filing Type", sectionId: "building_scope" });
      }

      // Ensure directive_14 is always tracked
      const hasDirective14 = allFields.some(f => f.id === "directive_14");
      if (!hasDirective14) {
        allFields.push({ id: "directive_14", label: "Directive 14?", sectionId: "building_scope" });
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

      const isMissing = (f: { id: string; sectionId: string }) => {
        const flatVal = responses[f.id];
        const prefixedVal = responses[`${f.sectionId}_${f.id}`];
        const val = prefixedVal ?? flatVal;
        if (val === null || val === undefined || val === "") return true;
        if (Array.isArray(val)) return val.length === 0;
        return String(val).trim().length === 0;
      };

      const missingFields = allFields
        .filter(isMissing)
        .map(f => f.label);

      // Build grouped missing fields by section heading
      const missingBySection: Record<string, string[]> = {};
      // Track current heading per field for grouping
      const fieldHeadingMap = new Map<string, string>();
      for (const section of sections) {
        if (EXCLUDED_PIS_SECTION_IDS.has(section.id)) continue;
        const fields = (section.fields as any[]) || [];
        let heading = section.title || section.id;
        for (const field of fields) {
          if (field.type === "heading") {
            heading = (field.label as string || "").replace(/\s*\(.*\)/, "").trim();
            continue;
          }
          fieldHeadingMap.set(field.id, heading);
        }
      }
      // Ensure injected fields have heading mappings
      if (!fieldHeadingMap.has("filing_type")) fieldHeadingMap.set("filing_type", "Building Details & Scope of Work");
      if (!fieldHeadingMap.has("directive_14")) fieldHeadingMap.set("directive_14", "Building Details & Scope of Work");

      for (const f of allFields) {
        if (!isMissing(f)) continue;
        const heading = fieldHeadingMap.get(f.id) || "Other";
        if (!missingBySection[heading]) missingBySection[heading] = [];
        // Use the raw label without the heading prefix for the grouped view
        const rawLabel = (f.label.includes(" — ") ? f.label.split(" — ").slice(1).join(" — ") : f.label);
        missingBySection[heading].push(rawLabel);
      }

      // Append grouped TBD labels for unknown contractors
      const contractorsHeading = "Contractors & Inspections";
      const ensureHeading = () => { if (!missingBySection[contractorsHeading]) missingBySection[contractorsHeading] = []; };

      if (!gcSameAs && !gcHasDetails) {
        missingFields.push("General Contractor (TBD)");
        ensureHeading();
        missingBySection[contractorsHeading].push("General Contractor (TBD)");
      }
      if (!tppSameAs && !tppHasDetails) {
        missingFields.push("TPP Applicant (TBD)");
        ensureHeading();
        missingBySection[contractorsHeading].push("TPP Applicant (TBD)");
      }
      if (!siaSameAs && !siaHasDetails) {
        missingFields.push("Special Inspector (TBD)");
        ensureHeading();
        missingBySection[contractorsHeading].push("Special Inspector (TBD)");
      }

      return {
        sentDate: format(new Date(rfi.created_at), "MM/dd/yyyy"),
        totalFields,
        completedFields,
        missingFields,
        missingBySection,
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
