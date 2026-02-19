import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertTriangle, UserPlus, CheckCircle2, Loader2, Copy, Search, Building2, User, Zap } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MockPISStatus } from "./projectMockData";
import { usePISContactOptions, getPriorSectionFields } from "@/hooks/usePISAutoFill";

interface PisFieldDef {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "number" | "select" | "checkbox" | "heading";
  width?: "full" | "half";
  options?: string[];
  placeholder?: string;
}

interface PisSection {
  id: string;
  title: string;
  description?: string;
  contactRole?: string; // If set, we check if this person is in the CRM
  fields: PisFieldDef[];
}

const PIS_SECTIONS: PisSection[] = [
  {
    id: "building_scope",
    title: "Building Details & Scope of Work",
    description: "Property info and scope",
    fields: [
      { id: "project_address", label: "Project Address", type: "text", width: "full" },
      { id: "borough", label: "Borough", type: "text", width: "half" },
      { id: "block", label: "Block", type: "text", width: "half" },
      { id: "lot", label: "Lot", type: "text", width: "half" },
      { id: "floors", label: "Floor(s)", type: "text", width: "half" },
      { id: "apt_numbers", label: "Apt #(s)", type: "text", width: "half" },
      { id: "sq_ft", label: "Area (sq ft)", type: "number", width: "half" },
      { id: "job_description", label: "Job Description", type: "textarea", width: "full", placeholder: "Describe the scope of work..." },
      { id: "directive_14", label: "Directive 14?", type: "select", options: ["Yes", "No"], width: "half" },
    ],
  },
  {
    id: "applicant",
    title: "Applicant (Architect / Engineer)",
    description: "Licensed professional filing the application",
    contactRole: "Applicant",
    fields: [
      { id: "filing_type", label: "Filing Type", type: "select", options: ["Plan Exam", "Pro-Cert", "TBD"], width: "half" },
      { id: "client_reference_number", label: "Client Reference Number", type: "text", width: "half", placeholder: "e.g. NY Tent #611490" },
      { id: "applicant_name", label: "Full Name", type: "text", width: "half" },
      { id: "applicant_business_name", label: "Business Name", type: "text", width: "half" },
      { id: "applicant_business_address", label: "Business Address", type: "text", width: "full" },
      { id: "applicant_phone", label: "Phone", type: "phone", width: "half" },
      { id: "applicant_email", label: "Email", type: "email", width: "half" },
      { id: "applicant_nys_lic", label: "NYS License #", type: "text", width: "half" },
      { id: "applicant_lic_type", label: "License Type", type: "select", options: ["RA", "PE"], width: "half" },
    ],
  },
  {
    id: "owner",
    title: "Building Owner",
    description: "Property owner information",
    contactRole: "Owner",
    fields: [
      { id: "ownership_type", label: "Ownership Type", type: "select", options: ["Individual", "Corporation", "Partnership", "Condo/Co-op", "Non-profit", "Government"], width: "half" },
      { id: "non_profit", label: "Non-Profit?", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "owner_name", label: "Owner Name", type: "text", width: "half" },
      { id: "owner_title", label: "Title", type: "text", width: "half" },
      { id: "owner_company", label: "Company / Entity Name", type: "text", width: "full" },
      { id: "owner_address", label: "Address", type: "text", width: "full" },
      { id: "owner_email", label: "Email", type: "email", width: "half" },
      { id: "owner_phone", label: "Phone", type: "phone", width: "half" },
      { id: "corp_officer_name", label: "Corporate Officer Name", type: "text", width: "half" },
      { id: "corp_officer_title", label: "Corporate Officer Title", type: "text", width: "half" },
    ],
  },
  {
    id: "gc",
    title: "General Contractor",
    description: "GC details and credentials",
    contactRole: "General Contractor",
    fields: [
      { id: "gc_name", label: "Name", type: "text", width: "half" },
      { id: "gc_company", label: "Company", type: "text", width: "half" },
      { id: "gc_phone", label: "Phone", type: "phone", width: "half" },
      { id: "gc_email", label: "Email", type: "email", width: "half" },
      { id: "gc_address", label: "Address", type: "text", width: "full" },
      { id: "gc_dob_tracking", label: "DOB Tracking #", type: "text", width: "half" },
      { id: "gc_hic_lic", label: "HIC License #", type: "text", width: "half" },
    ],
  },
  {
    id: "tpp",
    title: "TPP Applicant",
    description: "Third-party provider info",
    contactRole: "TPP",
    fields: [
      { id: "tpp_name", label: "Name", type: "text", width: "half" },
      { id: "tpp_email", label: "Email", type: "email", width: "half" },
      { id: "rent_controlled", label: "Rent Controlled?", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "rent_stabilized", label: "Rent Stabilized?", type: "select", options: ["Yes", "No"], width: "half" },
      { id: "units_occupied", label: "Occupied Units", type: "number", width: "half" },
    ],
  },
  {
    id: "sia",
    title: "Special Inspections (SIA)",
    description: "Special inspection agency details",
    contactRole: "SIA",
    fields: [
      { id: "sia_name", label: "Name", type: "text", width: "half" },
      { id: "sia_company", label: "Company", type: "text", width: "half" },
      { id: "sia_phone", label: "Phone", type: "phone", width: "half" },
      { id: "sia_email", label: "Email", type: "email", width: "half" },
      { id: "sia_number", label: "SIA #", type: "text", width: "half" },
      { id: "sia_nys_lic", label: "NYS License #", type: "text", width: "half" },
    ],
  },
  {
    id: "notes",
    title: "Insurance & Special Notes",
    description: "Additional project information",
    fields: [
      { id: "insurance_certs", label: "Insurance Certificates", type: "textarea", width: "full", placeholder: "GC cert on file, Architect cert pending, etc." },
      { id: "site_contact", label: "Site Contact & Access", type: "text", width: "full", placeholder: "Contact name — availability" },
      { id: "special_notes", label: "Special Notes / Instructions", type: "textarea", width: "full", placeholder: "Any special instructions..." },
    ],
  },
];

interface SectionAutoFillProps {
  sectionId: string;
  sectionTitle: string;
  getOptions: (sectionId: string, query: string) => { id: string; label: string; sublabel?: string; source: string; fields: Record<string, string> }[];
  priorResponses: Record<string, any> | null;
  onApply: (fields: Record<string, string>) => void;
}

function SectionAutoFill({ sectionId, sectionTitle, getOptions, priorResponses, onApply }: SectionAutoFillProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = getOptions(sectionId, search);
  const priorFields = priorResponses ? getPriorSectionFields(priorResponses, sectionId) : null;

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      {priorFields && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-7 text-xs shrink-0"
          onClick={() => onApply(priorFields)}
        >
          <Zap className="h-3 w-3" /> Same as last time
        </Button>
      )}
      <div ref={wrapperRef} className="relative flex-1 min-w-[180px]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => { if (search.trim()) setOpen(true); }}
            placeholder={`Search contacts for ${sectionTitle}...`}
            className="h-7 text-xs pl-7"
          />
        </div>
        {open && search.trim() && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-[9999] rounded-md border bg-popover shadow-lg max-h-[180px] overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left transition-colors"
                onClick={() => {
                  onApply(r.fields);
                  setSearch("");
                  setOpen(false);
                }}
              >
                {r.source === "client" ? (
                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate">{r.label}</div>
                  {r.sublabel && <div className="text-[10px] text-muted-foreground truncate">{r.sublabel}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EditPISDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pisStatus: MockPISStatus;
  projectId: string;
}

export function EditPISDialog({ open, onOpenChange, pisStatus, projectId }: EditPISDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clients = [] } = useClients();
  const { getOptionsForSection, sectionFieldMap } = usePISContactOptions();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [addedToCRM, setAddedToCRM] = useState<Set<string>>(new Set());

  // Load existing RFI responses
  const { data: rfiData } = useQuery({
    queryKey: ["rfi-responses", projectId],
    queryFn: async () => {
      const { data } = await (supabase.from("rfi_requests") as any)
        .select("id, responses")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; responses: Record<string, any> } | null;
    },
    enabled: !!projectId && open,
  });

  // Fetch prior PIS at same property for clone
  const { data: priorPIS } = useQuery({
    queryKey: ["prior-pis", projectId],
    queryFn: async () => {
      // Get this project's property_id
      const { data: proj } = await supabase.from("projects").select("property_id").eq("id", projectId).single();
      if (!proj?.property_id) return null;
      // Find other projects at same property
      const { data: otherProjects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("property_id", proj.property_id)
        .neq("id", projectId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!otherProjects || otherProjects.length === 0) return null;
      // Get latest RFI from those projects
      const { data: priorRfi } = await (supabase.from("rfi_requests") as any)
        .select("id, responses, project_id")
        .in("project_id", otherProjects.map(p => p.id))
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!priorRfi?.responses) return null;
      const priorProject = otherProjects.find(p => p.id === priorRfi.project_id);
      return { responses: priorRfi.responses as Record<string, any>, projectName: priorProject?.name || "Previous project" };
    },
    enabled: !!projectId && open,
  });

  const handleCloneFromPrior = () => {
    if (!priorPIS?.responses) return;
    const mapped: Record<string, string> = {};
    const resp = priorPIS.responses;
    for (const section of PIS_SECTIONS) {
      for (const field of section.fields) {
        if (field.type === "heading") continue;
        // Skip scope-specific fields
        if (["job_description", "filing_type", "client_reference_number"].includes(field.id)) continue;
        const prefixedKey = `${section.id}_${field.id}`;
        const val = resp[prefixedKey] ?? resp[field.id];
        if (val && !values[field.id]) {
          mapped[field.id] = String(val);
        }
        // Also try any key ending with field id
        for (const [key, v] of Object.entries(resp)) {
          if (key.endsWith(`_${field.id}`) && v && !values[field.id] && !mapped[field.id]) {
            mapped[field.id] = String(v);
          }
        }
      }
    }
    setValues(prev => ({ ...prev, ...mapped }));
    toast({ title: "Pre-filled", description: `Data cloned from "${priorPIS.projectName}". Review and save.` });
  };

  // Fetch proposal job_description if project was created from a proposal
  const { data: proposalJobDesc } = useQuery({
    queryKey: ["proposal-job-desc", projectId],
    queryFn: async () => {
      const { data: project } = await supabase
        .from("projects")
        .select("proposal_id")
        .eq("id", projectId)
        .single();
      if (!project?.proposal_id) return null;
      const { data: proposal } = await (supabase.from("proposals") as any)
        .select("job_description")
        .eq("id", project.proposal_id)
        .single();
      return (proposal?.job_description as string) || null;
    },
    enabled: !!projectId && open,
  });

  // Map RFI response keys (section_field) to flat field IDs
  useEffect(() => {
    if (!rfiData?.responses) return;
    const mapped: Record<string, string> = {};
    const resp = rfiData.responses;
    for (const section of PIS_SECTIONS) {
      for (const field of section.fields) {
        if (field.type === "heading") continue;
        if (resp[field.id] !== undefined) {
          mapped[field.id] = String(resp[field.id]);
        }
        const prefixedKey = `${section.id}_${field.id}`;
        if (resp[prefixedKey] !== undefined) {
          mapped[field.id] = String(resp[prefixedKey]);
        }
        for (const [key, val] of Object.entries(resp)) {
          if (key.endsWith(`_${field.id}`) && val && !mapped[field.id]) {
            mapped[field.id] = String(val);
          }
        }
      }
    }
    // Pre-fill job_description from proposal if not already filled
    if (!mapped["job_description"] && proposalJobDesc) {
      mapped["job_description"] = proposalJobDesc;
    }
    setValues(mapped);
  }, [rfiData, proposalJobDesc]);

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // Check if a contact name exists in the CRM
  const isContactInCRM = (nameFieldId: string): boolean => {
    const name = values[nameFieldId]?.trim();
    if (!name) return true;
    if (addedToCRM.has(nameFieldId)) return true;
    return clients.some((c) =>
      c.name.toLowerCase().includes(name.toLowerCase())
    );
  };

  // Count filled fields
  const allFields = PIS_SECTIONS.flatMap((s) => s.fields.filter((f) => f.type !== "heading"));
  const filledCount = allFields.filter((f) => values[f.id]?.trim()).length;

  const getSectionProgress = (section: PisSection) => {
    const fields = section.fields.filter((f) => f.type !== "heading");
    const filled = fields.filter((f) => values[f.id]?.trim()).length;
    return { filled, total: fields.length };
  };

  const getContactNameField = (section: PisSection): string | null => {
    if (!section.contactRole) return null;
    const nameField = section.fields.find(
      (f) => f.id.endsWith("_name") && f.type === "text"
    );
    return nameField?.id || null;
  };

  const handleSave = async () => {
    if (!rfiData?.id) {
      toast({ title: "No PIS record found", description: "Send a PIS to the client first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Merge values back into the existing responses object
      const updatedResponses = { ...(rfiData.responses || {}) };
      for (const section of PIS_SECTIONS) {
        for (const field of section.fields) {
          if (field.type === "heading") continue;
          const val = values[field.id];
          if (val !== undefined) {
            // Store with section prefix to match RFI format
            const prefixedKey = `${section.id}_${field.id}`;
            updatedResponses[prefixedKey] = val;
            // Also store flat key
            updatedResponses[field.id] = val;
          }
        }
      }
      const { error } = await (supabase.from("rfi_requests") as any)
        .update({ responses: updatedResponses, updated_at: new Date().toISOString() })
        .eq("id", rfiData.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["rfi-responses", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-pis-status", projectId] });
      toast({ title: "PIS Saved", description: `${filledCount}/${allFields.length} fields completed.` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: PisFieldDef) => {
    const key = field.id;
    const widthClass = field.width === "half" ? "col-span-1" : "col-span-2";

    if (field.type === "heading") return null;

    return (
      <div key={key} className={`space-y-1.5 ${widthClass}`}>
        <Label htmlFor={key} className="text-sm font-medium">
          {field.label}
        </Label>
        {field.type === "textarea" ? (
          <Textarea
            id={key}
            value={values[key] || ""}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            className="min-h-[70px]"
          />
        ) : field.type === "select" ? (
          <Select value={values[key] || ""} onValueChange={(v) => updateValue(key, v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={key}
            type={field.type === "phone" ? "tel" : field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
            value={values[key] || ""}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            className="h-9"
          />
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project Information Sheet</DialogTitle>
          <DialogDescription>
            {filledCount}/{allFields.length} fields completed
            {pisStatus.sentDate && ` · Sent ${pisStatus.sentDate}`}
          </DialogDescription>
        </DialogHeader>

        {priorPIS && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 text-sm">
            <span className="text-muted-foreground">Prior PIS found at this address from "{priorPIS.projectName}"</span>
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs ml-auto" onClick={handleCloneFromPrior}>
              <Copy className="h-3 w-3" /> Pre-fill from prior
            </Button>
          </div>
        )}

        <Accordion type="multiple" defaultValue={PIS_SECTIONS.map((s) => s.id)} className="w-full">
          {PIS_SECTIONS.map((section) => {
            const progress = getSectionProgress(section);
            const contactNameField = getContactNameField(section);
            const contactInCRM = contactNameField ? isContactInCRM(contactNameField) : true;
            const hasContactName = contactNameField ? !!values[contactNameField]?.trim() : false;

            return (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <span className="font-medium">{section.title}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {progress.filled}/{progress.total}
                    </Badge>
                    {section.contactRole && hasContactName && !contactInCRM && (
                      <Badge variant="destructive" className="text-[10px] shrink-0 gap-1">
                        <AlertTriangle className="h-3 w-3" /> Not in CRM
                      </Badge>
                    )}
                    {section.contactRole && hasContactName && contactInCRM && (
                      <Badge variant="outline" className="text-[10px] shrink-0 gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> In CRM
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {section.contactRole && sectionFieldMap[section.id] && (
                    <SectionAutoFill
                      sectionId={section.id}
                      sectionTitle={section.contactRole}
                      getOptions={getOptionsForSection}
                      priorResponses={priorPIS?.responses || null}
                      onApply={(fields) => {
                        setValues(prev => ({ ...prev, ...fields }));
                        toast({ title: "Auto-filled", description: `${section.contactRole} details populated.` });
                      }}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    {section.fields.map((field) => renderField(field))}
                  </div>
                  {section.contactRole && hasContactName && !contactInCRM && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="text-sm text-destructive">
                        "{values[contactNameField!]}" is not in your contacts.
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto gap-1.5 h-7 text-xs"
                        onClick={async () => {
                          try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) throw new Error("Not authenticated");
                            const { data: profile } = await supabase
                              .from("profiles")
                              .select("company_id")
                              .eq("user_id", user.id)
                              .maybeSingle();
                            if (!profile?.company_id) throw new Error("No company found. Please complete your profile setup first.");

                            const contactName = values[contactNameField!];
                            // Extract related fields from this section
                            const emailField = section.fields.find(f => f.id.endsWith("_email"));
                            const phoneField = section.fields.find(f => f.id.endsWith("_phone"));
                            const companyField = section.fields.find(f => f.id.endsWith("_company") || f.id.endsWith("_business_name"));

                            // Create client (company) record
                            const { data: newClient, error: clientErr } = await supabase
                              .from("clients")
                              .insert({
                                company_id: profile.company_id,
                                name: companyField ? (values[companyField.id] || contactName) : contactName,
                                email: emailField ? values[emailField.id] || null : null,
                                phone: phoneField ? values[phoneField.id] || null : null,
                                client_type: section.contactRole || null,
                              })
                              .select()
                              .single();
                            if (clientErr) throw clientErr;

                            // Create contact under that client
                            const nameParts = contactName.split(" ");
                            await supabase.from("client_contacts").insert({
                              client_id: newClient.id,
                              company_id: profile.company_id,
                              name: contactName,
                              first_name: nameParts[0] || contactName,
                              last_name: nameParts.slice(1).join(" ") || null,
                              email: emailField ? values[emailField.id] || null : null,
                              phone: phoneField ? values[phoneField.id] || null : null,
                              company_name: companyField ? values[companyField.id] || null : null,
                              title: section.contactRole || null,
                              is_primary: true,
                            });

                            setAddedToCRM(prev => new Set(prev).add(contactNameField!));
                            queryClient.invalidateQueries({ queryKey: ["clients"] });
                            toast({ title: "Contact Added", description: `"${contactName}" has been added to your CRM.` });
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                          }
                        }}
                      >
                        <UserPlus className="h-3 w-3" /> Add to CRM
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save PIS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
