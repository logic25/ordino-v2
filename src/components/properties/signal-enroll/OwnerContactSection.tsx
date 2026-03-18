import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface OwnerContactSectionProps {
  ownerEmail: string;
  onOwnerEmailChange: (val: string) => void;
  ownerPhone: string;
  onOwnerPhoneChange: (val: string) => void;
  notes: string;
  onNotesChange: (val: string) => void;
}

export function OwnerContactSection({
  ownerEmail,
  onOwnerEmailChange,
  ownerPhone,
  onOwnerPhoneChange,
  notes,
  onNotesChange,
}: OwnerContactSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Owner Email</Label>
        <Input type="email" placeholder="owner@example.com" value={ownerEmail} onChange={(e) => onOwnerEmailChange(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Owner Phone</Label>
        <Input type="tel" placeholder="(555) 555-5555" value={ownerPhone} onChange={(e) => onOwnerPhoneChange(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea placeholder="Sales notes, outreach status..." value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={3} />
      </div>
    </>
  );
}
