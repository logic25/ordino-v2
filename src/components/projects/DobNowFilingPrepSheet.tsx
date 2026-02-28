import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, CheckCircle2, AlertTriangle, MapPin, Building2,
  User, Phone, Mail, ExternalLink, ClipboardList, Save,
  Plus, Trash2, Settings, Download,
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
  const [jobNumber, setJobNumber] = useState(service.application?.jobNumber || "");
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST.map((item) => ({ ...item, checked: false }))
  );

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const saveJobNumber = () => {
    if (!jobNumber.trim()) return;
    toast({ title: "Job Number Saved", description: `Application #${jobNumber} linked to ${service.name}.` });
  };

  // Build DOB field mapping from project data
  const property = project.properties;
  const proj = project as any;

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
    { label: "Work Types / Disciplines", value: (service.subServices || []).length > 0 ? (service.subServices || []).join(", ") : null, category: "filing", dobFieldName: "Work Type" },
    { label: "Floor", value: proj.floor_number, category: "filing", dobFieldName: "Floor" },
    { label: "Unit / Apt", value: proj.unit_number, category: "filing", dobFieldName: "Apt/Suite" },
    { label: "Estimated Job Cost", value: service.estimatedCosts && (service.estimatedCosts || []).length > 0 ? (service.estimatedCosts || []).map(ec => `${ec.discipline}: $${ec.amount.toLocaleString()}`).join("; ") : (proj.estimated_value ? `$${Number(proj.estimated_value).toLocaleString()}` : null), category: "filing", dobFieldName: "Estimated Job Cost" },
    { label: "Job Description", value: service.jobDescription || null, category: "filing", dobFieldName: "Description of Work", editable: true },
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

  // Filter contacts relevant to this service's disciplines
  const serviceDisciplines = (service.subServices || []).map(s => s.toLowerCase());
  const filteredContacts = contacts.filter((c) => {
    // Engineers should only appear if their discipline matches the service's subServices
    if (c.dobRole === "engineer" && c.discipline) {
      const engLabel = (engineerDisciplineLabels[c.discipline] || c.discipline).toLowerCase();
      // Match if subServices includes the discipline or related terms (e.g. "GC" won't match "structural")
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
  const filledFields = allFields.filter((f) => f.value);
  // Only flag truly required roles as missing (not sia_applicant/tpp_applicant unless relevant)
  const missingContacts = ["applicant", "owner", "filing_rep"].filter(
    (role) => !contactsByRole[role]?.length
  );
  const checklistComplete = checklist.filter((c) => c.required).every((c) => c.checked);
  const requiredChecked = checklist.filter((c) => c.required && c.checked).length;
  const requiredTotal = checklist.filter((c) => c.required).length;

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
                <FieldRow key={field.label} field={field} onCopy={copyToClipboard} />
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
                  onClick={() => window.open("/settings?section=lists&tab=filing_checklist", "_blank")}
                >
                  <Settings className="h-3 w-3" /> Defaults
                </Button>
              </div>
            </div>
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
                <div key={item.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-md bg-background border group/check">
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

          {/* Post-Filing Workflow */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" /> Post-Filing
            </h3>

            {/* Copy All Fields button for manual DOB NOW form filling */}
            <div className="space-y-3">
              <div className="p-3 rounded-lg border bg-background">
                <p className="text-xs text-muted-foreground mb-2">
                  Copy all field data to paste into DOB NOW/BUILD forms.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => {
                    const allData = [...propertyFields, ...filingFields]
                      .filter((f) => f.value)
                      .map((f) => `${f.dobFieldName || f.label}: ${f.value}`)
                      .join("\n");
                    const contactData = Object.entries(contactsByRole)
                      .flatMap(([role, contacts]) =>
                        contacts.map((c) => `${dobRoleLabelsMap[role] || role}: ${c.name} (${c.email || "no email"})`)
                      )
                      .join("\n");
                    navigator.clipboard.writeText(`${allData}\n\n--- CONTACTS ---\n${contactData}`);
                    toast({ title: "All fields copied", description: "Paste into DOB NOW/BUILD form fields." });
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy All Fields to Clipboard
                </Button>
              </div>

              {/* Job Number entry */}
              <div className="p-3 rounded-lg border bg-background">
                <p className="text-xs text-muted-foreground mb-2">
                  After filing, enter the job/application number assigned by DOB NOW.
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

              {/* Scrape from DOB NOW */}
              <div className="p-3 rounded-lg border bg-background">
                <p className="text-xs text-muted-foreground mb-2">
                  Or look up the job number from DOB NOW by property address.
                </p>
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
            </div>
          </div>

          {/* Open DOB NOW — copies all fields to clipboard first */}
          <Button
            className="w-full gap-2"
            onClick={() => {
              const allData = [...propertyFields, ...filingFields]
                .filter((f) => f.value)
                .map((f) => `${f.dobFieldName || f.label}: ${f.value}`)
                .join("\n");
              const contactData = Object.entries(contactsByRole)
                .flatMap(([role, rContacts]) =>
                  rContacts.map((c) => `${dobRoleLabelsMap[role] || role}: ${c.name} — ${c.email || ""} — ${c.phone || ""}`)
                )
                .join("\n");
              navigator.clipboard.writeText(`${allData}\n\n--- CONTACTS ---\n${contactData}`);
              toast({ title: "Fields copied to clipboard", description: "Opening DOB NOW BUILD — paste fields into the application form." });
              setTimeout(() => window.open("https://a810-dobnow.nyc.gov/publish/#!/", "_blank"), 500);
            }}
          >
            <ExternalLink className="h-4 w-4" /> Open DOB NOW BUILD
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Individual field row with copy button, missing highlight, and optional inline editing
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
