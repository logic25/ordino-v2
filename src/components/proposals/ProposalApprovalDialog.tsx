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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, FileText, Mail, Handshake, FolderOpen } from "lucide-react";
import { useAssignableProfiles } from "@/hooks/useProfiles";

interface ProposalApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (method: string, notes?: string, signedDocUrl?: string, assignedPmId?: string) => void;
  isLoading?: boolean;
  proposalTitle?: string;
  defaultPmId?: string;
}

const APPROVAL_METHODS = [
  {
    value: "physical_copy",
    label: "Physical signed copy",
    description: "Client printed, signed, and returned a hard copy",
    icon: FileText,
  },
  {
    value: "client_agreement",
    label: "Client's own agreement",
    description: "Working off the client's contract/agreement instead",
    icon: Handshake,
  },
  {
    value: "email_confirmation",
    label: "Email confirmation",
    description: "Client approved via email — just mark it done",
    icon: Mail,
  },
];

export function ProposalApprovalDialog({
  open,
  onOpenChange,
  onApprove,
  isLoading,
  proposalTitle,
  defaultPmId,
}: ProposalApprovalDialogProps) {
  const [method, setMethod] = useState("physical_copy");
  const [notes, setNotes] = useState("");
  const [assignedPmId, setAssignedPmId] = useState(defaultPmId || "");
  const { data: assignableProfiles = [] } = useAssignableProfiles();

  const handleSubmit = () => {
    onApprove(method, notes || undefined, undefined, assignedPmId || undefined);
    setMethod("physical_copy");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Mark Proposal as Approved
          </DialogTitle>
          <DialogDescription>
            {proposalTitle ? `"${proposalTitle}" — ` : ""}
            How was this proposal accepted? A project will be created automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={method} onValueChange={setMethod} className="space-y-3">
            {APPROVAL_METHODS.map((m) => (
              <label
                key={m.value}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  method === m.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-accent/50"
                }`}
              >
                <RadioGroupItem value={m.value} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <m.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{m.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="approval-pm">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                Assign Project Manager
              </span>
            </Label>
            <Select value={assignedPmId} onValueChange={setAssignedPmId}>
              <SelectTrigger id="approval-pm">
                <SelectValue placeholder="Select PM..." />
              </SelectTrigger>
              <SelectContent>
                {assignableProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval-notes">Notes (optional)</Label>
            <Textarea
              id="approval-notes"
              placeholder="e.g. Signed copy received on 2/14, filed in project folder..."
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
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Project...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve & Create Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
