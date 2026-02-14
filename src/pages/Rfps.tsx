import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Library, Upload, LayoutGrid, List } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRfps, useCreateRfp } from "@/hooks/useRfps";
import { RfpKanbanBoard } from "@/components/rfps/RfpKanbanBoard";
import { RfpTableView } from "@/components/rfps/RfpTableView";
import { RfpSummaryCards, type RfpFilter } from "@/components/rfps/RfpSummaryCards";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Rfps() {
  const navigate = useNavigate();
  const [view, setView] = useState<"kanban" | "table">("table");
  const [cardFilter, setCardFilter] = useState<RfpFilter>(null);
  const { data: rfps = [], isLoading } = useRfps();
  const createRfp = useCreateRfp();
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    rfp_number: "",
    agency: "",
    due_date: "",
    contract_value: "",
    mwbe_goal_min: "",
    submission_method: "",
    notes: "",
  });

  const resetForm = () => setForm({ title: "", rfp_number: "", agency: "", due_date: "", contract_value: "", mwbe_goal_min: "", submission_method: "", notes: "" });

  const handleCreate = async () => {
    if (!form.title) { toast({ title: "Title is required", variant: "destructive" }); return; }
    try {
      await createRfp.mutateAsync({
        title: form.title,
        rfp_number: form.rfp_number || null,
        agency: form.agency || null,
        status: "prospect",
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
        mwbe_goal_min: form.mwbe_goal_min ? parseFloat(form.mwbe_goal_min) : null,
        submission_method: form.submission_method || null,
        notes: form.notes || null,
      });
      toast({ title: "RFP created" });
      setNewOpen(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">RFPs</h1>
            <p className="text-muted-foreground text-sm">
              Track and respond to Requests for Proposals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "kanban" | "table")} size="sm" variant="outline">
              <ToggleGroupItem value="table" aria-label="Table view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Kanban view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" onClick={() => navigate("/rfps/library")}>
              <Library className="h-4 w-4 mr-2" /> Content Library
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> New RFP
            </Button>
          </div>
        </div>

        <RfpSummaryCards rfps={rfps} activeFilter={cardFilter} onFilterChange={setCardFilter} />

        {view === "kanban" ? (
          <RfpKanbanBoard rfps={rfps} isLoading={isLoading} />
        ) : (
          <RfpTableView rfps={rfps} isLoading={isLoading} cardFilter={cardFilter} />
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New RFP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. DOE School Renovation Expediting" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>RFP #</Label>
                <Input value={form.rfp_number} onChange={(e) => setForm({ ...form, rfp_number: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Agency</Label>
                <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Contract Value ($)</Label>
                <Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>M/WBE Goal %</Label>
                <Input type="number" value={form.mwbe_goal_min} onChange={(e) => setForm({ ...form, mwbe_goal_min: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Submission Method</Label>
                <Select value={form.submission_method} onValueChange={(v) => setForm({ ...form, submission_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="in-person">In Person</SelectItem>
                    <SelectItem value="mail">Mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createRfp.isPending || !form.title}>
              {createRfp.isPending ? "Creating..." : "Create RFP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
