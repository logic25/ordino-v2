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
import { Loader2, UserPlus } from "lucide-react";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useLeadSources } from "@/hooks/useLeadSources";

export interface LeadCaptureData {
  source: string;
  first_name: string;
  last_name: string;
  contact_phone?: string;
  contact_email?: string;
  property_address?: string;
  service_needed?: string;
  notes?: string;
  assigned_pm_id?: string;
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

export function LeadCaptureDialog({ open, onOpenChange, onSubmit, isLoading }: LeadCaptureDialogProps) {
  const [source, setSource] = useState("phone_call");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [serviceNeeded, setServiceNeeded] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedPmId, setAssignedPmId] = useState("");

  const { data: pmProfiles = [] } = useAssignableProfiles();
  const { data: leadSources = [] } = useLeadSources();

  // Merge settings lead sources with defaults
  const activeSources = leadSources.length > 0
    ? leadSources.filter((s) => s.is_active).map((s) => ({ value: s.name.toLowerCase().replace(/\s+/g, "_"), label: s.name }))
    : DEFAULT_SOURCES;

  const handleSubmit = () => {
    if (!firstName.trim() && !lastName.trim()) return;
    onSubmit({
      source,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      contact_phone: contactPhone || undefined,
      contact_email: contactEmail || undefined,
      property_address: propertyAddress || undefined,
      service_needed: serviceNeeded || undefined,
      notes: notes || undefined,
      assigned_pm_id: assignedPmId || undefined,
    });
    // Reset
    setFirstName("");
    setLastName("");
    setContactPhone("");
    setContactEmail("");
    setPropertyAddress("");
    setServiceNeeded("");
    setNotes("");
    setAssignedPmId("");
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
            Quick-capture a lead from a call, email, or website form. Creates a draft proposal and assigns it.
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

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-first-name">First Name *</Label>
              <Input
                id="lead-first-name"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-last-name">Last Name *</Label>
              <Input
                id="lead-last-name"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input
                id="lead-phone"
                placeholder="(555) 555-1234"
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

          {/* Property */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-property">Property Address</Label>
            <Input
              id="lead-property"
              placeholder="123 Main St, Brooklyn, NY"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
            />
          </div>

          {/* Service needed */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-service">Service Needed</Label>
            <Input
              id="lead-service"
              placeholder="e.g. Alt-1 Filing, New Building Permit..."
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              placeholder="What did they say on the call? Any details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={(!firstName.trim() && !lastName.trim()) || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Lead & Proposal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
