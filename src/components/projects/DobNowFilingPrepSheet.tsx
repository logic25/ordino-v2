import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  Copy, CheckCircle2, AlertTriangle, MapPin, Building2,
  User, Phone, Mail, ExternalLink, ClipboardList, Save,
  Plus, Trash2, Settings, Download, Type, ChevronDown, ChevronRight,
  ArrowLeft, Loader2, Bot, Circle, XCircle, Eye,
} from "lucide-react";
import type { MockService, MockContact } from "./projectMockData";
import { engineerDisciplineLabels } from "./projectMockData";
import type { ProjectWithRelations } from "@/hooks/useProjects";

interface DobField {
  label: string;
  value: string | null | undefined;
  category: string;
  dobFieldName?: string;
  editable?: boolean;
  fromPIS?: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "checked">[] = [
  { id: "ins", label: "Insurance certificate on file", required: true },
  { id: "sealed", label: "Sealed plans with job numbers", required: true },
  { id: "owner_auth", label: "Owner authorization letter", required: true },
  { id: "dob_reg", label: "All contacts registered on DOB NOW", required: true },
  { id: "acp5", label: "ACP5 / Asbestos investigation (if applicable)", required: false },
  { id: "dep_cert", label: "DEP Sewer Certification (if applicable)", required: false },
  { id: "cc_info", label: "Credit card info for DOB filing fees", required: true },
  { id: "scope_desc", label: "Scope of work description finalized", required: true },
  { id: "est_cost", label: "Estimated cost confirmed by client", required: true },
  { id: "restrictive", label: "Restrictive declaration (if required)", required: false },
];

// ---- Helpers ----

function stripFormatting(text: string): string {
  let cleaned = text
    .replace(/<[^>]*>/g, "")          // Remove HTML tags
    .replace(/&nbsp;/gi, " ")         // Replace &nbsp;
    .replace(/[\u201C\u201D]/g, '"')  // Curly double quotes → straight
    .replace(/[\u2018\u2019]/g, "'")  // Curly single quotes → straight
    .replace(/\s{2,}/g, " ")          // Collapse multiple spaces
    .trim();
  return cleaned;
}

// Public PIS form uses "building_and_scope_" prefix, internal uses "building_scope_"
const PUBLIC_PREFIX_MAP: Record<string, string> = {
  building_scope: "building_and_scope",
  applicant: "applicant_and_owner",
  gc: "contractors_inspections",
};

function getPISValue(responses: Record<string, any> | null, sectionPrefix: string, fieldName: string): string | null {
  if (!responses) return null;
  // Try internal prefixed key first
  const prefixed = `${sectionPrefix}_${fieldName}`;
  // Then try public-form prefixed key
  const publicPrefix = PUBLIC_PREFIX_MAP[sectionPrefix];
  const publicPrefixed = publicPrefix ? `${publicPrefix}_${fieldName}` : null;
  const val = responses[prefixed] ?? (publicPrefixed ? responses[publicPrefixed] : undefined) ?? responses[fieldName];
  if (val === null || val === undefined || val === "") return null;
  return String(val);
}

function getPISArrayValue(responses: Record<string, any> | null, sectionPrefix: string, fieldName: string): string[] | null {
  if (!responses) return null;
  const prefixed = `${sectionPrefix}_${fieldName}`;
  const publicPrefix = PUBLIC_PREFIX_MAP[sectionPrefix];
  const publicPrefixed = publicPrefix ? `${publicPrefix}_${fieldName}` : null;
  const val = responses[prefixed] ?? (publicPrefixed ? responses[publicPrefixed] : undefined) ?? responses[fieldName];
  if (!val) return null;
  if (Array.isArray(val)) return val.filter(Boolean);
  try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) return parsed; } catch {}
  return null;
}

// ---- Submit flow steps ----
type SubmitStep = "idle" | "confirm" | "submitting" | "success" | "agent";

interface FilingRunProgress {
  step: string;
  status: string;
  timestamp: string;
}

// ---- Component ----

interface DobNowFilingPrepSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: MockService;
  project: ProjectWithRelations;
  contacts: MockContact[];
  allServices: MockService[];
}

export function DobNowFilingPrepSheet({
  open,
  onOpenChange,
  service,
  project,
  contacts,
  allServices,
}: DobNowFilingPrepSheetProps) {
  const { toast } = useToast();
  const { data: companyData } = useCompanySettings();
  const [jobNumber, setJobNumber] = useState(service.application?.jobNumber || "");
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [checklistInitialized, setChecklistInitialized] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST.map((item) => ({ ...item, checked: false }))
  );
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const [confirmSectionOpen, setConfirmSectionOpen] = useState<Record<string, boolean>>({ location: true, stakeholders: true, filing: true });
  const [editOverrides, setEditOverrides] = useState<Record<string, string>>({});
  const [filedAt, setFiledAt] = useState<Date | null>(null);
  const [filerName, setFilerName] = useState<string | null>(null);
  const [checklistWarning, setChecklistWarning] = useState(false);
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [agentProgress, setAgentProgress] = useState<FilingRunProgress[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [launchingAgent, setLaunchingAgent] = useState(false);

  // Realtime subscription for agent progress
  useEffect(() => {
    if (!agentRunId) return;
    const channel = supabase
      .channel(`filing-run-${agentRunId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "filing_runs", filter: `id=eq.${agentRunId}` },
        (payload: any) => {
          const row = payload.new;
          setAgentStatus(row.status);
          setAgentProgress(Array.isArray(row.progress_log) ? row.progress_log : []);
          if (row.error_message) setAgentError(row.error_message);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agentRunId]);



  useEffect(() => {
    if (companyData && !checklistInitialized) {
      const saved = companyData.settings?.filing_checklist_defaults;
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setChecklist(saved.map((item: any) => ({ id: item.id, label: item.label, required: !!item.required, checked: false })));
      }
      setChecklistInitialized(true);
    }
  }, [companyData, checklistInitialized]);

  // Fetch PIS (rfi_requests) data for this project
  const { data: pisResponses } = useQuery({
    queryKey: ["filing-pis-data", project.id],
    queryFn: async () => {
      const { data } = await (supabase.from("rfi_requests") as any)
        .select("responses")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.responses as Record<string, any>) || null;
    },
    enabled: !!project.id && open,
  });

  // Fetch current user profile for audit trail
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id, display_name, company_id").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: open,
  });

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
    setChecklistWarning(false);
  };

  const saveJobNumber = () => {
    if (!jobNumber.trim()) return;
    toast({ title: "Job Number Saved", description: `Application #${jobNumber} linked to ${service.name}.` });
  };

  // Build DOB field mapping from project data + PIS
  const property = project.properties;
  const proj = project as any;

  // PIS-derived values (try both internal and public-form prefixes)
  const pisSquareFootage = getPISValue(pisResponses, "building_scope", "sq_ft");
  const pisJobDescription = getPISValue(pisResponses, "building_scope", "job_description");
  const pisWorkTypes = getPISArrayValue(pisResponses, "building_scope", "work_types");
  const pisFloor = getPISValue(pisResponses, "building_scope", "floors");
  const pisUnit = getPISValue(pisResponses, "building_scope", "apt_numbers");
  const pisEstimatedJobCost = getPISValue(pisResponses, "building_scope", "estimated_job_cost");
  const pisApplicantName = getPISValue(pisResponses, "applicant", "applicant_name");
  const pisApplicantEmail = getPISValue(pisResponses, "applicant", "applicant_email");
  const pisApplicantPhone = getPISValue(pisResponses, "applicant", "applicant_phone");
  const pisApplicantCompany = getPISValue(pisResponses, "applicant", "applicant_business_name");

  // Prefer PIS job description over service's
  const jobDescription = pisJobDescription || service.jobDescription || null;
  // Prefer PIS work types over service's subServices
  const workTypes = pisWorkTypes && pisWorkTypes.length > 0 ? pisWorkTypes : (service.subServices || []);

  // Floor: prefer project field, fallback to PIS
  const floorValue = proj.floor_number || pisFloor || null;
  const floorFromPIS = !proj.floor_number && !!pisFloor;
  // Unit: prefer project field, fallback to PIS
  const unitValue = proj.unit_number || pisUnit || null;
  const unitFromPIS = !proj.unit_number && !!pisUnit;
  // Estimated Job Cost: prefer service costs, then PIS, then project estimated_value
  const estCostValue = service.estimatedCosts && (service.estimatedCosts || []).length > 0
    ? (service.estimatedCosts || []).map(ec => `${ec.discipline}: $${ec.amount.toLocaleString()}`).join("; ")
    : pisEstimatedJobCost
      ? `$${Number(pisEstimatedJobCost).toLocaleString()}`
      : (proj.estimated_value ? `$${Number(proj.estimated_value).toLocaleString()}` : null);
  const estCostFromPIS = !(service.estimatedCosts && (service.estimatedCosts || []).length > 0) && !!pisEstimatedJobCost;

  const propertyFields: DobField[] = [
    { label: "House Number", value: property?.address?.match(/^(\d+[\w-]*)/)?.[1], category: "property", dobFieldName: "House Number" },
    { label: "Street Name", value: property?.address?.replace(/^(\d+[\w-]*)\s*/, ""), category: "property", dobFieldName: "Street Name" },
    { label: "Borough", value: (property as any)?.borough, category: "property", dobFieldName: "Borough" },
    { label: "Block", value: (property as any)?.block, category: "property", dobFieldName: "Block" },
    { label: "Lot", value: (property as any)?.lot, category: "property", dobFieldName: "Lot" },
    { label: "BIN", value: (property as any)?.bin, category: "property", dobFieldName: "BIN" },
  ];

  const filingFields: DobField[] = [
    { label: "Filing Type", value: service.name, category: "filing", dobFieldName: "Filing Type" },
    { label: "Work Types / Disciplines", value: workTypes.length > 0 ? workTypes.join(", ") : null, category: "filing", dobFieldName: "Work Type", fromPIS: !!(pisWorkTypes && pisWorkTypes.length > 0) },
    { label: "Floor", value: floorValue, category: "filing", dobFieldName: "Floor", fromPIS: floorFromPIS },
    { label: "Unit / Apt", value: unitValue, category: "filing", dobFieldName: "Apt/Suite", fromPIS: unitFromPIS },
    { label: "Floor Area (sq ft)", value: pisSquareFootage, category: "filing", dobFieldName: "Floor Area (sq ft)", fromPIS: !!pisSquareFootage },
    { label: "Estimated Job Cost", value: estCostValue, category: "filing", dobFieldName: "Estimated Job Cost", fromPIS: estCostFromPIS },
    { label: "Job Description", value: jobDescription, category: "filing", dobFieldName: "Description of Work", editable: true, fromPIS: !!pisJobDescription },
  ];

  // Map contacts by DOB role
  const dobRoleLabelsMap: Record<string, string> = {
    applicant: "Applicant",
    owner: "Owner",
    sia_applicant: "SIA Applicant",
    tpp_applicant: "TPP Applicant",
    filing_rep: "Filing Representative",
    architect: "Architect of Record",
    engineer: "Engineer of Record",
    gc: "General Contractor",
    other: "Other",
  };

  const serviceDisciplines = (service.subServices || []).map(s => s.toLowerCase());
  const filteredContacts = contacts.filter((c) => {
    if (c.dobRole === "engineer" && c.discipline) {
      const engLabel = (engineerDisciplineLabels[c.discipline] || c.discipline).toLowerCase();
      return serviceDisciplines.some(ss =>
        engLabel.includes(ss.toLowerCase()) || ss.toLowerCase().includes(engLabel)
      );
    }
    return true;
  });

  const contactsByRole = filteredContacts.reduce((acc, c) => {
    if (!acc[c.dobRole]) acc[c.dobRole] = [];
    acc[c.dobRole].push(c);
    return acc;
  }, {} as Record<string, MockContact[]>);

  const allFields = [...propertyFields, ...filingFields];
  const missingFields = allFields.filter((f) => !f.value);
  const missingContacts = ["applicant", "owner", "filing_rep"].filter(
    (role) => !contactsByRole[role]?.length
  );
  const requiredChecked = checklist.filter((c) => c.required && c.checked).length;
  const requiredTotal = checklist.filter((c) => c.required).length;
  const checklistComplete = checklist.filter((c) => c.required).every((c) => c.checked);

  // Build full payload for confirmation card
  const buildPayload = () => {
    const cleanedJobDesc = stripFormatting(editOverrides["Job Description"] || jobDescription || "");
    return {
      location: propertyFields.map(f => ({
        label: f.dobFieldName || f.label,
        value: editOverrides[f.label] ?? f.value ?? null,
      })),
      stakeholders: Object.entries(contactsByRole).flatMap(([role, cs]) =>
        cs.map(c => ({
          role: dobRoleLabelsMap[role] || role,
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
        }))
      ),
      filing: [
        { label: "Filing Type", value: service.name },
        { label: "Work Types", value: workTypes.join(", ") || null },
        { label: "Floor", value: editOverrides["Floor"] ?? proj.floor_number ?? null },
        { label: "Unit / Apt", value: editOverrides["Unit / Apt"] ?? proj.unit_number ?? null },
        { label: "Floor Area (sq ft)", value: editOverrides["Floor Area (sq ft)"] ?? pisSquareFootage ?? null },
        { label: "Estimated Job Cost", value: editOverrides["Estimated Job Cost"] ?? filingFields.find(f => f.label === "Estimated Job Cost")?.value ?? null },
        { label: "Job Description", value: cleanedJobDesc || null },
      ],
    };
  };

  // Launch filing agent
  const handleLaunchAgent = async () => {
    if (!currentUser || !checklistComplete) {
      if (!checklistComplete) {
        setChecklistWarning(true);
        toast({ title: "Checklist incomplete", description: "Complete all required checklist items before launching the agent.", variant: "destructive" });
      }
      return;
    }
    setLaunchingAgent(true);
    try {
      const payload = buildPayload();
      const { data: run, error } = await (supabase.from("filing_runs") as any).insert({
        company_id: currentUser.company_id,
        project_id: project.id,
        service_id: service.id,
        status: "queued",
        payload_snapshot: payload,
        created_by: currentUser.id,
      }).select("id").single();

      if (error || !run) {
        toast({ title: "Error", description: "Failed to create filing run.", variant: "destructive" });
        return;
      }

      setAgentRunId(run.id);
      setAgentStatus("queued");
      setAgentProgress([]);
      setAgentError(null);
      setSubmitStep("agent");

      (supabase.from("filing_audit_log" as any).insert({
        company_id: currentUser.company_id,
        project_id: project.id,
        service_id: service.id,
        initiated_by: currentUser.id,
        filing_type: service.name,
        work_types: workTypes,
        property_address: property?.address || null,
        method: "agent",
        payload_snapshot: payload,
      }) as any).then(() => {});

      toast({ title: "Agent queued", description: "The filing agent will start processing shortly." });
    } finally {
      setLaunchingAgent(false);
    }
  };

  const handleSubmitClick = () => {
    if (!checklistComplete) {
      setChecklistWarning(true);
      toast({ title: "Checklist incomplete", description: "Complete all required checklist items before submitting.", variant: "destructive" });
      return;
    }
    setSubmitStep("confirm");
  };

  const handleConfirmAndOpen = async () => {
    setSubmitStep("submitting");
    const payload = buildPayload();

    // Copy to clipboard
    const allData = [
      ...payload.location.filter(f => f.value).map(f => `${f.label}: ${f.value}`),
      "",
      ...payload.filing.filter(f => f.value).map(f => `${f.label}: ${f.value}`),
      "",
      "--- CONTACTS ---",
      ...payload.stakeholders.map(s => `${s.role}: ${s.name} (${s.email || "no email"}) ${s.phone || ""}`),
    ].join("\n");
    await navigator.clipboard.writeText(allData);

    // Fire-and-forget audit log
    if (currentUser) {
      (supabase.from("filing_audit_log" as any).insert({
        company_id: currentUser.company_id,
        project_id: project.id,
        service_id: service.id,
        initiated_by: currentUser.id,
        filing_type: service.name,
        work_types: workTypes,
        property_address: property?.address || null,
        method: "clipboard",
        payload_snapshot: payload,
      }) as any).then(() => {});
    }

    setFiledAt(new Date());
    setFilerName(currentUser?.display_name || "Unknown");
    setSubmitStep("success");

    // Open DOB NOW
    setTimeout(() => window.open("https://a810-dobnow.nyc.gov/publish/#!/", "_blank"), 400);
    toast({ title: "Fields copied to clipboard", description: "Opening DOB NOW BUILD — paste fields into the application form." });
  };

  const handleStripFormatting = () => {
    const current = editOverrides["Job Description"] || jobDescription || "";
    const stripped = stripFormatting(current);
    setEditOverrides(prev => ({ ...prev, "Job Description": stripped }));
    toast({ title: "Formatting stripped", description: "Plain-text formatting applied to job description." });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            DOB NOW Filing Prep
          </SheetTitle>
          <SheetDescription>
            {service.name} — {property?.address || "No address"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Readiness summary */}
          <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
            missingFields.length === 0 && missingContacts.length === 0
              ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
              : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
          }`}>
            {missingFields.length === 0 && missingContacts.length === 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  All fields complete · {requiredChecked}/{requiredTotal} checklist
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  {missingFields.length + missingContacts.length} missing field{missingFields.length + missingContacts.length !== 1 ? "s" : ""} · {requiredChecked}/{requiredTotal} checklist
                </span>
              </>
            )}
          </div>

          {/* Property Data */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Property Information
            </h3>
            <div className="space-y-1.5">
              {propertyFields.map((field) => (
                <FieldRow key={field.label} field={field} onCopy={copyToClipboard} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Filing Details */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> Filing Details
            </h3>
            <div className="space-y-1.5">
              {filingFields.map((field) => (
                <div key={field.label}>
                  <FieldRow field={field} onCopy={copyToClipboard} />
                  {field.label === "Job Description" && field.value && (
                    <div className="flex items-center gap-1 mt-1 ml-3">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={handleStripFormatting}>
                        <Type className="h-3 w-3" /> Strip Formatting
                      </Button>
                      {pisJobDescription && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-200">From PIS</Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Contacts by DOB Role */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Contacts by DOB Role
            </h3>
            <div className="space-y-3">
              {Object.entries(dobRoleLabelsMap).map(([role, roleLabel]) => {
                const roleContacts = contactsByRole[role] || [];
                const isRequired = ["applicant", "owner", "filing_rep"].includes(role);
                if (roleContacts.length === 0 && !isRequired) return null;

                return (
                  <div key={role} className={`p-3 rounded-lg border text-sm ${
                    roleContacts.length === 0 && isRequired
                      ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30"
                      : "bg-background"
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-medium text-xs uppercase tracking-wider text-muted-foreground">{roleLabel}</span>
                      {isRequired && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>}
                    </div>
                    {roleContacts.length === 0 ? (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs">
                        <AlertTriangle className="h-3 w-3" /> Not assigned
                      </div>
                    ) : (
                      roleContacts.map((contact) => (
                        <div key={contact.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{contact.name}</span>
                            <div className="flex items-center gap-1.5">
                              {contact.dobRegistered === "registered" ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-200">✓ DOB Registered</Badge>
                              ) : contact.dobRegistered === "not_registered" ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-600 border-red-200">✗ Not Registered</Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">{contact.company}</div>
                          <div className="flex items-center gap-4 text-xs mt-1">
                            {contact.email && (
                              <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => copyToClipboard(contact.email, "Email")}>
                                <Mail className="h-3 w-3" /> {contact.email} <Copy className="h-2.5 w-2.5" />
                              </button>
                            )}
                            {contact.phone && (
                              <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" onClick={() => copyToClipboard(contact.phone, "Phone")}>
                                <Phone className="h-3 w-3" /> {contact.phone} <Copy className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Pre-Filing Checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Pre-Filing Checklist ({requiredChecked}/{requiredTotal} required)
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-muted-foreground"
                  onClick={() => setShowAddItem(!showAddItem)}
                >
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-muted-foreground"
                  onClick={() => {
                    const saved = companyData?.settings?.filing_checklist_defaults;
                    if (saved && Array.isArray(saved) && saved.length > 0) {
                      setChecklist(saved.map((item: any) => ({ id: item.id, label: item.label, required: !!item.required, checked: false })));
                      toast({ title: "Checklist reset", description: "Loaded company default checklist items." });
                    } else {
                      setChecklist(DEFAULT_CHECKLIST.map((item) => ({ ...item, checked: false })));
                      toast({ title: "Checklist reset", description: "No saved defaults found — using built-in defaults." });
                    }
                  }}
                >
                  <Settings className="h-3 w-3" /> Defaults
                </Button>
              </div>
            </div>
            {checklistWarning && !checklistComplete && (
              <div className="flex items-center gap-2 p-2 mb-2 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Complete all required checklist items before submitting.
              </div>
            )}
            {showAddItem && (
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="New checklist item..."
                  value={newItemLabel}
                  onChange={(e) => setNewItemLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newItemLabel.trim()) {
                      setChecklist((prev) => [...prev, { id: `custom_${Date.now()}`, label: newItemLabel.trim(), required: false, checked: false }]);
                      setNewItemLabel("");
                      setShowAddItem(false);
                    }
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="sm" className="h-8 text-xs" onClick={() => {
                  if (newItemLabel.trim()) {
                    setChecklist((prev) => [...prev, { id: `custom_${Date.now()}`, label: newItemLabel.trim(), required: false, checked: false }]);
                    setNewItemLabel("");
                    setShowAddItem(false);
                  }
                }}>Add</Button>
              </div>
            )}
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className={`flex items-center gap-3 text-sm py-2 px-3 rounded-md bg-background border group/check ${
                  checklistWarning && item.required && !item.checked ? "border-destructive/50 bg-destructive/5" : ""
                }`}>
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={() => toggleChecklist(item.id)}
                    className="h-4 w-4"
                  />
                  <span className={item.checked ? "text-muted-foreground line-through flex-1" : "flex-1"}>
                    {item.label}
                  </span>
                  {item.required && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>
                  )}
                  <button
                    className="opacity-0 group-hover/check:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => setChecklist((prev) => prev.filter((c) => c.id !== item.id))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Submit Flow */}
          <div>
            {submitStep === "idle" && (
              <div className="space-y-2">
                <Button className="w-full gap-2" onClick={handleSubmitClick}>
                  <ExternalLink className="h-4 w-4" /> Submit to DOB NOW (Manual)
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 border-primary/30 hover:bg-primary/5"
                  onClick={handleLaunchAgent}
                  disabled={launchingAgent}
                >
                  {launchingAgent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                  Launch Filing Agent
                </Button>
              </div>
            )}

            {submitStep === "confirm" && (
              <ConfirmationCard
                payload={buildPayload()}
                workTypes={workTypes}
                editOverrides={editOverrides}
                setEditOverrides={setEditOverrides}
                onConfirm={handleConfirmAndOpen}
                onBack={() => setSubmitStep("idle")}
                confirmSectionOpen={confirmSectionOpen}
                setConfirmSectionOpen={setConfirmSectionOpen}
              />
            )}

            {submitStep === "submitting" && (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Copying and opening DOB NOW...
              </div>
            )}

            {submitStep === "success" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Filed on {filedAt?.toLocaleDateString()} at {filedAt?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} by {filerName}
                    </p>
                    <Badge variant="outline" className="text-[10px] mt-1">Method: Clipboard</Badge>
                  </div>
                </div>

                {/* Job Number entry */}
                <div className="p-3 rounded-lg border bg-background">
                  <p className="text-xs text-muted-foreground mb-2">
                    Enter the job/application number assigned by DOB NOW.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 520112847"
                      value={jobNumber}
                      onChange={(e) => setJobNumber(e.target.value)}
                      className="h-9 font-mono"
                    />
                    <Button size="sm" className="gap-1.5 shrink-0" onClick={saveJobNumber} disabled={!jobNumber.trim()}>
                      <Save className="h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                </div>

                {/* Pull from DOB NOW */}
                <div className="p-3 rounded-lg border bg-background">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => {
                      toast({ title: "Looking up filings...", description: `Searching DOB NOW for ${property?.address || "this property"}. This feature is coming soon.` });
                    }}
                  >
                    <Download className="h-3.5 w-3.5" /> Pull Job # from DOB NOW
                  </Button>
                </div>

                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setSubmitStep("idle")}>
                  Submit Again
                </Button>
              </div>
            )}

            {/* Agent Progress View */}
            {submitStep === "agent" && (
              <div className="space-y-3">
                {/* Status Header */}
                <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                  agentStatus === "completed"
                    ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                    : agentStatus === "failed"
                    ? "bg-destructive/10 border-destructive/30"
                    : agentStatus === "review_needed"
                    ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                    : "bg-primary/5 border-primary/20"
                }`}>
                  {agentStatus === "queued" && (
                    <>
                      <Circle className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-muted-foreground">Agent queued — waiting to start...</span>
                    </>
                  )}
                  {agentStatus === "running" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="font-medium text-primary">Agent is filling forms on DOB NOW...</span>
                    </>
                  )}
                  {agentStatus === "completed" && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">Filing completed successfully</span>
                    </>
                  )}
                  {agentStatus === "failed" && (
                    <>
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="font-medium text-destructive">Filing failed</span>
                    </>
                  )}
                  {agentStatus === "review_needed" && (
                    <>
                      <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="font-medium text-amber-700 dark:text-amber-300">Review needed before submission</span>
                    </>
                  )}
                </div>

                {/* Error Message */}
                {agentError && (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
                    {agentError}
                  </div>
                )}

                {/* Progress Log */}
                {agentProgress.length > 0 && (
                  <div className="p-3 rounded-lg border bg-background">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Progress</h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {agentProgress.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {entry.status === "success" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                          ) : entry.status === "error" ? (
                            <XCircle className="h-3 w-3 text-destructive shrink-0" />
                          ) : (
                            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                          )}
                          <span className="text-muted-foreground">{entry.step}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground/50">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {(agentStatus === "failed" || agentStatus === "review_needed") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setAgentRunId(null);
                        setAgentStatus(null);
                        setAgentProgress([]);
                        setAgentError(null);
                        setSubmitStep("idle");
                      }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Try Again
                    </Button>
                  )}
                  {agentStatus === "completed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        setAgentRunId(null);
                        setAgentStatus(null);
                        setAgentProgress([]);
                        setAgentError(null);
                        setSubmitStep("idle");
                      }}
                    >
                      Done
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---- Confirmation Card ----

function ConfirmationCard({
  payload,
  workTypes,
  editOverrides,
  setEditOverrides,
  onConfirm,
  onBack,
  confirmSectionOpen,
  setConfirmSectionOpen,
}: {
  payload: ReturnType<any>;
  workTypes: string[];
  editOverrides: Record<string, string>;
  setEditOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onConfirm: () => void;
  onBack: () => void;
  confirmSectionOpen: Record<string, boolean>;
  setConfirmSectionOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const toggleSection = (key: string) => setConfirmSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <ClipboardList className="h-4 w-4" /> Confirm Filing Data
      </h4>
      <p className="text-xs text-muted-foreground">Review the data below. Click any value to edit before submitting.</p>

      {/* Location */}
      <Collapsible open={confirmSectionOpen.location} onOpenChange={() => toggleSection("location")}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1 hover:text-foreground transition-colors">
          {confirmSectionOpen.location ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <MapPin className="h-3 w-3" /> Location Information
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1 mt-1">
            {payload.location.map((f: any) => (
              <ConfirmFieldRow key={f.label} label={f.label} value={editOverrides[f.label] ?? f.value} onEdit={(val) => setEditOverrides(prev => ({ ...prev, [f.label]: val }))} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Stakeholders */}
      <Collapsible open={confirmSectionOpen.stakeholders} onOpenChange={() => toggleSection("stakeholders")}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1 hover:text-foreground transition-colors">
          {confirmSectionOpen.stakeholders ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <User className="h-3 w-3" /> Stakeholders
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1 mt-1">
            {payload.stakeholders.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-2">No contacts assigned</p>
            ) : (
              payload.stakeholders.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-background border text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">{s.role}:</span>{" "}
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {s.email || <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-200">Missing</Badge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filing Details */}
      <Collapsible open={confirmSectionOpen.filing} onOpenChange={() => toggleSection("filing")}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1 hover:text-foreground transition-colors">
          {confirmSectionOpen.filing ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <ClipboardList className="h-3 w-3" /> Filing Details
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1 mt-1">
            {payload.filing.map((f: any) => {
              if (f.label === "Work Types") {
                return (
                  <div key={f.label} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-background border text-sm">
                    <span className="text-muted-foreground text-xs shrink-0">{f.label}</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {workTypes.length > 0 ? workTypes.map(wt => (
                        <Badge key={wt} variant="secondary" className="text-[10px] px-1.5 py-0">{wt}</Badge>
                      )) : <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-200">Missing</Badge>}
                    </div>
                  </div>
                );
              }
              if (f.label === "Job Description") {
                const val = editOverrides[f.label] ?? f.value ?? "";
                const truncated = val.length > 200;
                return (
                  <ConfirmFieldRow key={f.label} label={f.label} value={val} truncateAt={200} onEdit={(v) => setEditOverrides(prev => ({ ...prev, [f.label]: v }))} />
                );
              }
              return <ConfirmFieldRow key={f.label} label={f.label} value={editOverrides[f.label] ?? f.value} onEdit={(val) => setEditOverrides(prev => ({ ...prev, [f.label]: val }))} />;
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center gap-2 pt-2">
        <Button className="flex-1 gap-2 bg-orange-600 hover:bg-orange-700 text-white" onClick={onConfirm}>
          <ExternalLink className="h-4 w-4" /> Confirm & Open DOB NOW
        </Button>
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}

// ---- Confirmation field row with inline editing ----

function ConfirmFieldRow({ label, value, truncateAt, onEdit }: { label: string; value: string | null; truncateAt?: number; onEdit: (val: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value || "");
  const [expanded, setExpanded] = useState(false);

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1 px-2 rounded-md bg-background border">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <Input
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          className="h-7 text-sm flex-1"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") { onEdit(editVal); setEditing(false); }
            if (e.key === "Escape") { setEditVal(value || ""); setEditing(false); }
          }}
          onBlur={() => { onEdit(editVal); setEditing(false); }}
        />
      </div>
    );
  }

  const displayVal = truncateAt && value && value.length > truncateAt && !expanded
    ? value.slice(0, truncateAt) + "..."
    : value;

  return (
    <div
      className="flex items-center justify-between py-1.5 px-2 rounded-md bg-background border text-sm cursor-pointer hover:bg-muted/20 transition-colors"
      onClick={() => setEditing(true)}
    >
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      {value ? (
        <div className="text-right">
          <span className="font-medium text-sm max-w-[250px] truncate">{displayVal}</span>
          {truncateAt && value && value.length > truncateAt && (
            <button
              className="text-[10px] text-primary ml-1"
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </div>
      ) : (
        <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-200">Missing</Badge>
      )}
    </div>
  );
}

// ---- Individual field row with copy button ----

function FieldRow({
  field,
  onCopy,
}: {
  field: DobField;
  onCopy: (value: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(field.value || ""));

  if (!field.value && !editing) {
    return (
      <div
        className={`flex items-center justify-between py-1.5 px-3 rounded-md bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/30 dark:border-amber-800/30 ${field.editable ? "cursor-pointer" : ""}`}
        onClick={() => field.editable && setEditing(true)}
      >
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          <span className="text-muted-foreground">{field.label}</span>
          {field.dobFieldName && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">({field.dobFieldName})</span>
          )}
        </div>
        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          {field.editable ? "Click to edit" : "Missing"}
        </span>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1 px-3 rounded-md bg-background border">
        <span className="text-xs text-muted-foreground shrink-0">{field.label}</span>
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="h-7 text-sm flex-1"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") setEditing(false);
            if (e.key === "Escape") { setEditValue(String(field.value || "")); setEditing(false); }
          }}
          onBlur={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between py-1.5 px-3 rounded-md bg-background border group/field hover:bg-muted/20 transition-colors ${field.editable ? "cursor-pointer" : ""}`}
      onDoubleClick={() => field.editable && setEditing(true)}
    >
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-muted-foreground shrink-0">{field.label}</span>
        {field.dobFieldName && (
          <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">({field.dobFieldName})</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate max-w-[200px]">{field.value}</span>
        <button
          className="opacity-0 group-hover/field:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
          onClick={() => onCopy(String(field.value), field.label)}
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
