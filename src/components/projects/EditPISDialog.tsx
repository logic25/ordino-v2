import { useState, useEffect } from "react";
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
import { Save, AlertTriangle, UserPlus, CheckCircle2 } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import type { MockPISStatus } from "./projectMockData";

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

interface EditPISDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pisStatus: MockPISStatus;
}

export function EditPISDialog({ open, onOpenChange, pisStatus }: EditPISDialogProps) {
  const { toast } = useToast();
  const { data: clients = [] } = useClients();
  const [values, setValues] = useState<Record<string, string>>({});

  const updateValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // Check if a contact name exists in the CRM
  const isContactInCRM = (nameFieldId: string): boolean => {
    const name = values[nameFieldId]?.trim();
    if (!name) return true; // Empty is fine
    return clients.some((c) =>
      c.name.toLowerCase().includes(name.toLowerCase())
    );
  };

  // Count filled fields
  const allFields = PIS_SECTIONS.flatMap((s) => s.fields.filter((f) => f.type !== "heading"));
  const filledCount = allFields.filter((f) => {
    const key = f.id;
    return values[key]?.trim();
  }).length;

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

  const handleSave = () => {
    toast({
      title: "PIS Saved",
      description: `${filledCount}/${allFields.length} fields completed.`,
    });
    onOpenChange(false);
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
                        onClick={() => {
                          toast({
                            title: "Add Contact",
                            description: `Navigate to Companies to add "${values[contactNameField!]}" as a contact.`,
                          });
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
          <Button onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save PIS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
