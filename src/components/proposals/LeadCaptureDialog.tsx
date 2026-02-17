import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, UserPlus, ChevronDown, ChevronRight, Upload } from "lucide-react";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useLeadSources } from "@/hooks/useLeadSources";
import { ReferredByCombobox } from "@/components/proposals/ReferredByCombobox";

export interface LeadCaptureData {
  source: string;
  full_name: string;
  contact_phone?: string;
  contact_email?: string;
  property_address?: string;
  subject?: string;
  referred_by?: string;
  notes?: string;
  assigned_pm_id?: string;
  client_type?: string;
  create_proposal?: boolean;
  // Party info
  architect_name?: string;
  architect_company?: string;
  architect_phone?: string;
  architect_email?: string;
  architect_license_type?: string;
  architect_license_number?: string;
  gc_name?: string;
  gc_company?: string;
  gc_phone?: string;
  gc_email?: string;
  sia_name?: string;
  sia_company?: string;
  sia_phone?: string;
  sia_email?: string;
  tpp_name?: string;
  tpp_email?: string;
  drawings_files?: File[];
}

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: LeadCaptureData) => void;
  isLoading?: boolean;
}

const DEFAULT_SOURCES = [
  { value: "phone_call", label: "Phone Call" },
  { value: "email", label: "Email" },
  { value: "website_form", label: "Website Form" },
];

const CLIENT_TYPES = [
  { value: "homeowner", label: "Homeowner" },
  { value: "property_manager", label: "Property Manager" },
  { value: "contractor", label: "Contractor" },
  { value: "architect", label: "Architect" },
  { value: "developer", label: "Developer" },
  { value: "management_company", label: "Management Company" },
  { value: "government", label: "Government / Agency" },
  { value: "other", label: "Other" },
];

export function LeadCaptureDialog({ open, onOpenChange, onSubmit, isLoading }: LeadCaptureDialogProps) {
  const [source, setSource] = useState("phone_call");
  const [fullName, setFullName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedPmId, setAssignedPmId] = useState("");
  const [clientType, setClientType] = useState("");
  const [createProposal, setCreateProposal] = useState(false);

  // Party info state
  const [architectOpen, setArchitectOpen] = useState(false);
  const [architectName, setArchitectName] = useState("");
  const [architectCompany, setArchitectCompany] = useState("");
  const [architectPhone, setArchitectPhone] = useState("");
  const [architectEmail, setArchitectEmail] = useState("");
  const [architectLicType, setArchitectLicType] = useState("");
  const [architectLicNumber, setArchitectLicNumber] = useState("");

  const [gcOpen, setGcOpen] = useState(false);
  const [gcName, setGcName] = useState("");
  const [gcCompany, setGcCompany] = useState("");
  const [gcPhone, setGcPhone] = useState("");
  const [gcEmail, setGcEmail] = useState("");

  const [siaOpen, setSiaOpen] = useState(false);
  const [siaName, setSiaName] = useState("");
  const [siaCompany, setSiaCompany] = useState("");
  const [siaPhone, setSiaPhone] = useState("");
  const [siaEmail, setSiaEmail] = useState("");

  const [tppOpen, setTppOpen] = useState(false);
  const [tppName, setTppName] = useState("");
  const [tppEmail, setTppEmail] = useState("");

  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);

  const { data: pmProfiles = [] } = useAssignableProfiles();
  const { data: leadSources = [] } = useLeadSources();

  const activeSources = leadSources.length > 0
    ? leadSources.filter((s) => s.is_active && s.name.toLowerCase() !== "existing client").map((s) => ({ value: s.name.toLowerCase().replace(/\s+/g, "_"), label: s.name }))
    : DEFAULT_SOURCES;

  const resetAll = () => {
    setFullName(""); setContactPhone(""); setContactEmail(""); setPropertyAddress("");
    setSubject(""); setReferredBy(""); setNotes(""); setAssignedPmId("");
    setClientType(""); setCreateProposal(false); setSource("phone_call");
    setArchitectOpen(false); setArchitectName(""); setArchitectCompany("");
    setArchitectPhone(""); setArchitectEmail(""); setArchitectLicType(""); setArchitectLicNumber("");
    setGcOpen(false); setGcName(""); setGcCompany(""); setGcPhone(""); setGcEmail("");
    setSiaOpen(false); setSiaName(""); setSiaCompany(""); setSiaPhone(""); setSiaEmail("");
    setTppOpen(false); setTppName(""); setTppEmail("");
    setDrawingFiles([]);
  };

  const handleSubmit = () => {
    if (!fullName.trim()) return;
    onSubmit({
      source,
      full_name: fullName.trim(),
      contact_phone: contactPhone || undefined,
      contact_email: contactEmail || undefined,
      property_address: propertyAddress || undefined,
      subject: subject || undefined,
      referred_by: referredBy || undefined,
      notes: notes || undefined,
      assigned_pm_id: assignedPmId || undefined,
      client_type: clientType || undefined,
      create_proposal: createProposal,
      architect_name: architectName || undefined,
      architect_company: architectCompany || undefined,
      architect_phone: architectPhone || undefined,
      architect_email: architectEmail || undefined,
      architect_license_type: architectLicType || undefined,
      architect_license_number: architectLicNumber || undefined,
      gc_name: gcName || undefined,
      gc_company: gcCompany || undefined,
      gc_phone: gcPhone || undefined,
      gc_email: gcEmail || undefined,
      sia_name: siaName || undefined,
      sia_company: siaCompany || undefined,
      sia_phone: siaPhone || undefined,
      sia_email: siaEmail || undefined,
      tpp_name: tppName || undefined,
      tpp_email: tppEmail || undefined,
      drawings_files: drawingFiles.length > 0 ? drawingFiles : undefined,
    });
    resetAll();
  };

  const hasPartyInfo = (name: string, ...others: string[]) => 
    [name, ...others].some(v => v.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Capture New Lead
          </DialogTitle>
          <DialogDescription>
            Log a lead from a call, email, or website form. Optionally capture known project parties.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source */}
          <div className="space-y-2">
            <Label>Lead Source</Label>
            <div className="flex flex-wrap gap-2">
              {activeSources.map((s) => (
                <Badge
                  key={s.value}
                  variant={source === s.value ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-xs"
                  onClick={() => setSource(s.value)}
                >
                  {s.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Referred By */}
          {source.toLowerCase().includes("referral") && (
            <div className="space-y-1.5">
              <Label htmlFor="lead-referred-by">Referred By</Label>
              <ReferredByCombobox value={referredBy} onChange={setReferredBy} />
            </div>
          )}

          {/* Client Type */}
          <div className="space-y-1.5">
            <Label>Client Type</Label>
            <Select value={clientType} onValueChange={setClientType}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name *</Label>
            <Input id="lead-name" placeholder="John Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input id="lead-phone" placeholder="123-456-7899" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" placeholder="john@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-subject">Subject</Label>
            <Input id="lead-subject" placeholder="e.g. Summons, Violation, New Building..." value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {/* Property */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-property">Property Address</Label>
            <Input id="lead-property" placeholder="123 Main St, Brooklyn, NY 11201" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />
          </div>

          {/* ═══ Project Parties (collapsible) ═══ */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Known Project Parties (optional)</p>

            {/* Architect / Engineer */}
            <Collapsible open={architectOpen} onOpenChange={setArchitectOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-sm font-medium h-9 px-3">
                  <span className="flex items-center gap-2">
                    Architect / Engineer
                    {hasPartyInfo(architectName, architectCompany) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Added</Badge>}
                  </span>
                  {architectOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 px-3 pb-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name" value={architectName} onChange={(e) => setArchitectName(e.target.value)} />
                  <Input placeholder="Company" value={architectCompany} onChange={(e) => setArchitectCompany(e.target.value)} />
                  <Input placeholder="Phone" value={architectPhone} onChange={(e) => setArchitectPhone(e.target.value)} />
                  <Input type="email" placeholder="Email" value={architectEmail} onChange={(e) => setArchitectEmail(e.target.value)} />
                  <Select value={architectLicType} onValueChange={setArchitectLicType}>
                    <SelectTrigger><SelectValue placeholder="License type..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RA">RA</SelectItem>
                      <SelectItem value="PE">PE</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="License #" value={architectLicNumber} onChange={(e) => setArchitectLicNumber(e.target.value)} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* General Contractor */}
            <Collapsible open={gcOpen} onOpenChange={setGcOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-sm font-medium h-9 px-3">
                  <span className="flex items-center gap-2">
                    General Contractor
                    {hasPartyInfo(gcName, gcCompany) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Added</Badge>}
                  </span>
                  {gcOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 px-3 pb-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name" value={gcName} onChange={(e) => setGcName(e.target.value)} />
                  <Input placeholder="Company" value={gcCompany} onChange={(e) => setGcCompany(e.target.value)} />
                  <Input placeholder="Phone" value={gcPhone} onChange={(e) => setGcPhone(e.target.value)} />
                  <Input type="email" placeholder="Email" value={gcEmail} onChange={(e) => setGcEmail(e.target.value)} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* SIA */}
            <Collapsible open={siaOpen} onOpenChange={setSiaOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-sm font-medium h-9 px-3">
                  <span className="flex items-center gap-2">
                    Special Inspector (SIA)
                    {hasPartyInfo(siaName, siaCompany) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Added</Badge>}
                  </span>
                  {siaOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 px-3 pb-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name" value={siaName} onChange={(e) => setSiaName(e.target.value)} />
                  <Input placeholder="Company" value={siaCompany} onChange={(e) => setSiaCompany(e.target.value)} />
                  <Input placeholder="Phone" value={siaPhone} onChange={(e) => setSiaPhone(e.target.value)} />
                  <Input type="email" placeholder="Email" value={siaEmail} onChange={(e) => setSiaEmail(e.target.value)} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* TPP */}
            <Collapsible open={tppOpen} onOpenChange={setTppOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-sm font-medium h-9 px-3">
                  <span className="flex items-center gap-2">
                    TPP Applicant
                    {hasPartyInfo(tppName, tppEmail) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Added</Badge>}
                  </span>
                  {tppOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 px-3 pb-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Name" value={tppName} onChange={(e) => setTppName(e.target.value)} />
                  <Input type="email" placeholder="Email" value={tppEmail} onChange={(e) => setTppEmail(e.target.value)} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Drawings upload */}
          <div className="space-y-1.5">
            <Label>Plans / Drawings</Label>
            <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3 text-center">
              <input
                type="file"
                id="lead-drawings"
                className="hidden"
                multiple
                accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files) {
                    setDrawingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
              />
              <label htmlFor="lead-drawings" className="cursor-pointer flex flex-col items-center gap-1">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Click to attach drawings (PDF, DWG, JPG)</span>
              </label>
              {drawingFiles.length > 0 && (
                <div className="mt-2 text-left space-y-1">
                  {drawingFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button className="text-destructive ml-2" onClick={() => setDrawingFiles(prev => prev.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assign PM */}
          <div className="space-y-1.5">
            <Label>Assign To</Label>
            <Select value={assignedPmId} onValueChange={setAssignedPmId}>
              <SelectTrigger><SelectValue placeholder="Assign to admin/PM..." /></SelectTrigger>
              <SelectContent>
                {pmProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes / Message */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Message / Notes</Label>
            <Textarea
              id="lead-notes"
              placeholder="Details from the call, email, or website form submission..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Option to create proposal */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="lead-create-proposal"
              checked={createProposal}
              onCheckedChange={(checked) => setCreateProposal(!!checked)}
            />
            <Label htmlFor="lead-create-proposal" className="text-sm font-normal cursor-pointer">
              Also create a draft proposal for this lead
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!fullName.trim() || isLoading}>
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
            ) : (
              <><UserPlus className="mr-2 h-4 w-4" />{createProposal ? "Save Lead & Create Proposal" : "Save Lead"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
