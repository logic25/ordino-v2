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
import { Loader2, Phone, Mail, UserPlus } from "lucide-react";
import { useAssignableProfiles } from "@/hooks/useProfiles";

export interface LeadCaptureData {
  source: "phone_call" | "email" | "walk_in" | "referral" | "website";
  contact_name: string;
  contact_phone?: string;
  contact_email?: string;
  property_address?: string;
  property_id?: string;
  client_id?: string;
  notes?: string;
  assigned_pm_id?: string;
}

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: LeadCaptureData) => void;
  isLoading?: boolean;
}

const LEAD_SOURCES = [
  { value: "phone_call", label: "Phone Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "walk_in", label: "Walk-in", icon: UserPlus },
  { value: "referral", label: "Referral", icon: UserPlus },
  { value: "website", label: "Website Inquiry", icon: Mail },
];

export function LeadCaptureDialog({ open, onOpenChange, onSubmit, isLoading }: LeadCaptureDialogProps) {
  const [source, setSource] = useState<LeadCaptureData["source"]>("phone_call");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [assignedPmId, setAssignedPmId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: pmProfiles = [] } = useAssignableProfiles();

  const handleSubmit = () => {
    if (!contactName.trim()) return;
    onSubmit({
      source,
      contact_name: contactName.trim(),
      contact_phone: contactPhone || undefined,
      contact_email: contactEmail || undefined,
      property_address: propertyAddress || undefined,
      notes: notes || undefined,
      assigned_pm_id: assignedPmId || undefined,
    });
    // Reset
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setPropertyAddress("");
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
            Quick-capture a lead from a call, email, or walk-in. This creates a draft proposal and alerts the assigned PM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source */}
          <div className="space-y-2">
            <Label>How did they reach us?</Label>
            <div className="flex flex-wrap gap-2">
              {LEAD_SOURCES.map((s) => (
                <Badge
                  key={s.value}
                  variant={source === s.value ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-xs"
                  onClick={() => setSource(s.value as LeadCaptureData["source"])}
                >
                  <s.icon className="h-3 w-3 mr-1" />
                  {s.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lead-name">Contact Name *</Label>
              <Input
                id="lead-name"
                placeholder="John Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
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
            <Label htmlFor="lead-property">Property Address (if known)</Label>
            <Input
              id="lead-property"
              placeholder="123 Main St, Brooklyn, NY"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
            />
          </div>

          {/* Assign PM */}
          <div className="space-y-1.5">
            <Label>Assign to PM</Label>
            <Select value={assignedPmId} onValueChange={setAssignedPmId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a PM to alert..." />
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
              placeholder="What do they need? Any details from the call..."
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
          <Button onClick={handleSubmit} disabled={!contactName.trim() || isLoading}>
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
