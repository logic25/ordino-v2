import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Rfp, RfpStatus } from "@/hooks/useRfps";
import { useUpdateRfp } from "@/hooks/useRfps";
import { format } from "date-fns";

interface RfpEditDialogProps {
  rfp: Rfp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RfpEditDialog({ rfp, open, onOpenChange }: RfpEditDialogProps) {
  const updateRfp = useUpdateRfp();
  const [form, setForm] = useState({
    title: "",
    rfp_number: "",
    agency: "",
    status: "prospect" as RfpStatus,
    due_date: "",
    contract_value: "",
    mwbe_goal_min: "",
    mwbe_goal_max: "",
    notes: "",
    submission_method: "",
    submitted_at: "",
  });

  useEffect(() => {
    if (rfp) {
      setForm({
        title: rfp.title || "",
        rfp_number: rfp.rfp_number || "",
        agency: rfp.agency || "",
        status: rfp.status as RfpStatus,
        due_date: rfp.due_date ? format(new Date(rfp.due_date), "yyyy-MM-dd") : "",
        contract_value: rfp.contract_value?.toString() || "",
        mwbe_goal_min: rfp.mwbe_goal_min?.toString() || "",
        mwbe_goal_max: rfp.mwbe_goal_max?.toString() || "",
        notes: rfp.notes || "",
        submission_method: (rfp as any).submission_method || "",
        submitted_at: rfp.submitted_at ? format(new Date(rfp.submitted_at), "yyyy-MM-dd") : "",
      });
    }
  }, [rfp]);

  const handleSave = () => {
    if (!rfp) return;
    updateRfp.mutate({
      id: rfp.id,
      title: form.title,
      rfp_number: form.rfp_number || null,
      agency: form.agency || null,
      status: form.status,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
      mwbe_goal_min: form.mwbe_goal_min ? parseFloat(form.mwbe_goal_min) : null,
      mwbe_goal_max: form.mwbe_goal_max ? parseFloat(form.mwbe_goal_max) : null,
      notes: form.notes || null,
      submission_method: form.submission_method || null,
      submitted_at: form.submitted_at ? new Date(form.submitted_at).toISOString() : null,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit RFP</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>RFP #</Label>
              <Input value={form.rfp_number} onChange={(e) => update("rfp_number", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Agency</Label>
              <Input value={form.agency} onChange={(e) => update("agency", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="drafting">Drafting</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Contract Value ($)</Label>
              <Input type="number" value={form.contract_value} onChange={(e) => update("contract_value", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>M/WBE Min %</Label>
              <Input type="number" value={form.mwbe_goal_min} onChange={(e) => update("mwbe_goal_min", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>M/WBE Max %</Label>
              <Input type="number" value={form.mwbe_goal_max} onChange={(e) => update("mwbe_goal_max", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Submission Method</Label>
              <Select value={form.submission_method} onValueChange={(v) => update("submission_method", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="portal">Portal</SelectItem>
                  <SelectItem value="in-person">In Person</SelectItem>
                  <SelectItem value="mail">Mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Submitted Date</Label>
              <Input type="date" value={form.submitted_at} onChange={(e) => update("submitted_at", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateRfp.isPending || !form.title}>
            {updateRfp.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
