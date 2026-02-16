import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import type { MockPISStatus } from "./projectMockData";

interface PisField {
  key: string;
  label: string;
  value: string;
  type: "text" | "textarea";
}

interface EditPISDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pisStatus: MockPISStatus;
}

export function EditPISDialog({ open, onOpenChange, pisStatus }: EditPISDialogProps) {
  const { toast } = useToast();

  const [fields, setFields] = useState<PisField[]>([
    { key: "owner_info", label: "Owner / Client Contact Info", value: "Mayra Maisch — BGO — (212) 555-0101 — mayra@bgo.com", type: "text" },
    { key: "architect_info", label: "Architect of Record", value: "Antonio Rossi — Rossi Architecture — (212) 555-0202", type: "text" },
    { key: "engineer_info", label: "Engineer of Record", value: "David Chen — Chen Engineering — (212) 555-0404", type: "text" },
    { key: "gc_info", label: "General Contractor", value: "", type: "text" },
    { key: "insurance_certs", label: "Insurance Certificates", value: "GC cert on file, Architect cert pending", type: "text" },
    { key: "site_contact", label: "Site Contact & Access", value: "Mayra Maisch — Monday-Friday 8am-5pm", type: "text" },
    { key: "special_notes", label: "Special Notes / Instructions", value: "", type: "textarea" },
  ]);

  const updateField = (key: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
  };

  const completedCount = fields.filter((f) => f.value.trim()).length;

  const handleSave = () => {
    toast({
      title: "PIS Updated",
      description: `${completedCount}/${fields.length} fields saved.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project Information Sheet</DialogTitle>
          <DialogDescription>
            {completedCount}/{fields.length} fields completed
            {pisStatus.sentDate && ` · Sent ${pisStatus.sentDate}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.key}
                  value={field.value}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                  className="min-h-[80px]"
                />
              ) : (
                <Input
                  id={field.key}
                  value={field.value}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save PIS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
