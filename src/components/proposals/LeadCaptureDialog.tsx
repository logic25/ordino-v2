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
import { Loader2, UserPlus } from "lucide-react";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useLeadSources } from "@/hooks/useLeadSources";

export interface LeadCaptureData {
  source: string;
  full_name: string;
  contact_phone?: string;
  contact_email?: string;
  property_address?: string;
  subject?: string;
  service_needed?: string;
  notes?: string;
  assigned_pm_id?: string;
  client_type?: string;
  create_proposal?: boolean;
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
  { value: "website", label: "Website" },
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
  const [serviceNeeded, setServiceNeeded] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedPmId, setAssignedPmId] = useState("");
  const [clientType, setClientType] = useState("");
  const [createProposal, setCreateProposal] = useState(false);

  const { data: pmProfiles = [] } = useAssignableProfiles();
  const { data: leadSources = [] } = useLeadSources();

  const activeSources = leadSources.length > 0
    ? leadSources.filter((s) => s.is_active).map((s) => ({ value: s.name.toLowerCase().replace(/\s+/g, "_"), label: s.name }))
    : DEFAULT_SOURCES;

  const handleSubmit = () => {
    if (!fullName.trim()) return;
    onSubmit({
      source,
      full_name: fullName.trim(),
      contact_phone: contactPhone || undefined,
      contact_email: contactEmail || undefined,
      property_address: propertyAddress || undefined,
      subject: subject || undefined,
      service_needed: serviceNeeded || undefined,
      notes: notes || undefined,
      assigned_pm_id: assignedPmId || undefined,
      client_type: clientType || undefined,
      create_proposal: createProposal,
    });
    // Reset
    setFullName("");
    setContactPhone("");
    setContactEmail("");
    setPropertyAddress("");
    setSubject("");
    setServiceNeeded("");
    setNotes("");
    setAssignedPmId("");
    setClientType("");
    setCreateProposal(false);
    setSource("phone_call");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Capture New Lead
          </DialogTitle>
          <DialogDescription>
            Log a lead from a call, email, or website form. Optionally create a draft proposal.
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

          {/* Name — single field matching website form */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name *</Label>
            <Input
              id="lead-name"
              placeholder="Edward Ragusa"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                placeholder="(917) 734-9554"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                placeholder="john@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Client Type & Subject */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client Type</Label>
              <Select value={clientType} onValueChange={setClientType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-subject">Subject</Label>
              <Input
                id="lead-subject"
                placeholder="e.g. Summons, Violation, New Building..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>

          {/* Property */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-property">Property Address</Label>
            <Input
              id="lead-property"
              placeholder="327-329 South 1st Street, Brooklyn, NY 11211"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
            />
          </div>

          {/* Service needed */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-service">Service Needed</Label>
            <Input
              id="lead-service"
              placeholder="e.g. Violation Resolution, Alt-1, New Building Permit..."
              value={serviceNeeded}
              onChange={(e) => setServiceNeeded(e.target.value)}
            />
          </div>

          {/* Assign PM */}
          <div className="space-y-1.5">
            <Label>Assign To</Label>
            <Select value={assignedPmId} onValueChange={setAssignedPmId}>
              <SelectTrigger>
                <SelectValue placeholder="Assign to admin/PM..." />
              </SelectTrigger>
              <SelectContent>
                {pmProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes / Message — matches the website "Message" field */}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!fullName.trim() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                {createProposal ? "Save Lead & Create Proposal" : "Save Lead"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
