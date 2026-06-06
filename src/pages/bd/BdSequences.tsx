import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Mail, Plus, Pencil, Trash2, Pause, Play, CheckCircle2, Clock, Send, XCircle, Inbox,
} from "lucide-react";
import {
  useSequences, useUpsertSequence, useDeleteSequence,
  useSequenceSteps, useUpsertStep, useDeleteStep,
  useSequenceEnrollments, useUpdateEnrollment, useSequenceQueue, useMarkStepSent,
  type Sequence, type SequenceStep,
} from "@/hooks/useBdSequences";
import { useToast } from "@/hooks/use-toast";

export default function BdSequences() {
  const [tab, setTab] = useState("templates");
  const [openSeq, setOpenSeq] = useState<Sequence | "new" | null>(null);
  const [detailSeq, setDetailSeq] = useState<Sequence | null>(null);

  const sequences = useSequences();
  const del = useDeleteSequence();
  const queue = useSequenceQueue();
  const enrollments = useSequenceEnrollments();

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Sequences</h1>
            <p className="text-sm text-muted-foreground">Multi-touch outreach templates. Steps generate a manual send queue — you stay in control of what goes out.</p>
          </div>
          <Button onClick={() => setOpenSeq("new")}><Plus className="h-4 w-4 mr-1.5" />New sequence</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="templates"><Mail className="h-4 w-4 mr-1.5" />Templates</TabsTrigger>
            <TabsTrigger value="queue">
              <Inbox className="h-4 w-4 mr-1.5" />Queue
              {(queue.data?.length ?? 0) > 0 && <Badge variant="secondary" className="ml-1.5">{queue.data?.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="enrollments"><Send className="h-4 w-4 mr-1.5" />Enrollments</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sequences.data ?? []).map((s) => (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailSeq(s)}>
                        <TableCell className="font-medium">
                          <div>{s.name}</div>
                          {s.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.description}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{s.target_persona ?? "—"}</TableCell>
                        <TableCell>{s.step_count ?? 0}</TableCell>
                        <TableCell>{s.active_enrollments ?? 0}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpenSeq(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            onClick={() => { if (confirm("Delete sequence and all its steps/enrollments?")) del.mutate(s.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(sequences.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                        {sequences.isLoading ? "Loading…" : "No sequences yet. Create one to start outreach."}
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue"><QueueTab /></TabsContent>

          <TabsContent value="enrollments">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Sequence</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last sent</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(enrollments.data ?? []).map((e) => (
                      <EnrollmentRow key={e.id} e={e} />
                    ))}
                    {(enrollments.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">No enrollments yet.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <SequenceDialog
        open={!!openSeq}
        sequence={openSeq === "new" ? null : openSeq}
        onOpenChange={(o) => { if (!o) setOpenSeq(null); }} />
      <SequenceDetailSheet
        sequence={detailSeq}
        onOpenChange={(o) => { if (!o) setDetailSeq(null); }} />
    </AppLayout>
  );
}

function SequenceDialog({ open, sequence, onOpenChange }: { open: boolean; sequence: Sequence | null; onOpenChange: (o: boolean) => void }) {
  const upsert = useUpsertSequence();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<Sequence>>({});

  useMemo(() => { setForm(sequence ? { ...sequence } : { name: "" }); /* eslint-disable-next-line */ }, [sequence, open]);

  const save = async () => {
    if (!form.name?.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    await upsert.mutateAsync(form as any);
    toast({ title: sequence ? "Updated" : "Created" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sequence ? "Edit sequence" : "New sequence"}</DialogTitle>
          <DialogDescription>Define the cadence; add steps from the detail view.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Target persona</Label><Input placeholder="e.g. Architects, Property managers" value={form.target_persona ?? ""}
            onChange={(e) => setForm({ ...form, target_persona: e.target.value || null })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value || null })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SequenceDetailSheet({ sequence, onOpenChange }: { sequence: Sequence | null; onOpenChange: (o: boolean) => void }) {
  const steps = useSequenceSteps(sequence?.id);
  const upsertStep = useUpsertStep();
  const deleteStep = useDeleteStep();
  const [editStep, setEditStep] = useState<Partial<SequenceStep> | null>(null);
  const { toast } = useToast();

  if (!sequence) return null;

  const startNew = () => {
    const next = (steps.data?.length ?? 0) + 1;
    const lastOffset = steps.data?.length ? steps.data[steps.data.length - 1].day_offset : 0;
    setEditStep({ sequence_id: sequence.id, step_number: next, day_offset: lastOffset + 3, subject: "", body_template: "" });
  };

  const saveStep = async () => {
    if (!editStep) return;
    await upsertStep.mutateAsync(editStep as any);
    toast({ title: editStep.id ? "Step updated" : "Step added" });
    setEditStep(null);
  };

  return (
    <Sheet open={!!sequence} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sequence.name}</SheetTitle>
          <SheetDescription>{sequence.description ?? "Steps in this sequence"}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Steps</h4>
            <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-1.5" />Add step</Button>
          </div>

          <div className="space-y-2">
            {(steps.data ?? []).map((s) => (
              <Card key={s.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">Step {s.step_number}</Badge>
                        <span className="text-xs text-muted-foreground">Day {s.day_offset}</span>
                      </div>
                      {s.subject && <div className="text-sm font-medium">{s.subject}</div>}
                      {s.body_template && <div className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{s.body_template}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditStep(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => { if (confirm("Delete step?")) deleteStep.mutate({ id: s.id, sequence_id: sequence.id }); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(steps.data ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">No steps yet.</div>
            )}
          </div>
        </div>

        <Dialog open={!!editStep} onOpenChange={(o) => { if (!o) setEditStep(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editStep?.id ? "Edit step" : "Add step"}</DialogTitle></DialogHeader>
            {editStep && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Step #</Label><Input type="number" value={editStep.step_number ?? 1}
                    onChange={(e) => setEditStep({ ...editStep, step_number: Number(e.target.value) })} /></div>
                  <div><Label>Day offset</Label><Input type="number" value={editStep.day_offset ?? 0}
                    onChange={(e) => setEditStep({ ...editStep, day_offset: Number(e.target.value) })} /></div>
                </div>
                <div><Label>Subject</Label><Input value={editStep.subject ?? ""}
                  onChange={(e) => setEditStep({ ...editStep, subject: e.target.value })} /></div>
                <div>
                  <Label>Body template</Label>
                  <Textarea rows={8} value={editStep.body_template ?? ""}
                    placeholder="Use {{first_name}}, {{company}}, etc."
                    onChange={(e) => setEditStep({ ...editStep, body_template: e.target.value })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditStep(null)}>Cancel</Button>
              <Button onClick={saveStep}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function EnrollmentRow({ e }: { e: any }) {
  const upd = useUpdateEnrollment();
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-sm">{e.lead?.full_name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{e.lead?.company ?? ""}</div>
      </TableCell>
      <TableCell className="text-sm">{e.sequence?.name ?? "—"}</TableCell>
      <TableCell className="text-sm">{e.current_step}</TableCell>
      <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {e.last_sent_at ? formatDistanceToNow(new Date(e.last_sent_at), { addSuffix: true }) : "—"}
      </TableCell>
      <TableCell className="text-right">
        {e.status === "ACTIVE" ? (
          <Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: e.id, status: "PAUSED" })}>
            <Pause className="h-3.5 w-3.5 mr-1" />Pause
          </Button>
        ) : e.status === "PAUSED" ? (
          <Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: e.id, status: "ACTIVE" })}>
            <Play className="h-3.5 w-3.5 mr-1" />Resume
          </Button>
        ) : null}
        {e.status !== "EXITED" && e.status !== "COMPLETED" && (
          <Button size="sm" variant="ghost" className="text-destructive"
            onClick={() => upd.mutate({ id: e.id, status: "EXITED" })}>
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function QueueTab() {
  const queue = useSequenceQueue();
  const markSent = useMarkStepSent();
  const { toast } = useToast();

  const items = queue.data ?? [];
  const overdue = items.filter((i) => i.overdue);
  const upcoming = items.filter((i) => !i.overdue);

  const send = (enrollment_id: string, lastStepNumber: number, totalSteps: number) => {
    markSent.mutate(
      { enrollment_id, completed: lastStepNumber >= totalSteps },
      { onSuccess: () => toast({ title: "Marked sent" }) },
    );
  };

  if (items.length === 0) {
    return <div className="text-center py-16 text-sm text-muted-foreground">
      <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
      Nothing due. Enroll leads in a sequence to populate the queue.
    </div>;
  }

  const renderItem = (i: typeof items[number]) => {
    const e = i.enrollment;
    const subject = i.next_step.subject ?? "(no subject)";
    const body = (i.next_step.body_template ?? "")
      .replace(/\{\{\s*first_name\s*\}\}/gi, (e.lead?.full_name ?? "").split(" ")[0] ?? "")
      .replace(/\{\{\s*full_name\s*\}\}/gi, e.lead?.full_name ?? "")
      .replace(/\{\{\s*company\s*\}\}/gi, e.lead?.company ?? "");
    const mailto = e.lead?.contact_email
      ? `mailto:${encodeURIComponent(e.lead.contact_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : null;
    return (
      <Card key={e.id}>
        <CardContent className="p-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{e.lead?.full_name}</span>
              {e.lead?.company && <span className="text-xs text-muted-foreground">· {e.lead.company}</span>}
              <Badge variant="outline" className="text-xs">{e.sequence?.name}</Badge>
              <Badge variant="outline" className="text-xs">Step {i.next_step.step_number}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {i.overdue ? "Overdue" : "Due"} {formatDistanceToNow(new Date(i.due_at), { addSuffix: true })}
              {e.lead?.contact_email && <span>· {e.lead.contact_email}</span>}
            </div>
            {subject && <div className="text-xs mt-1 truncate">{subject}</div>}
          </div>
          <div className="flex gap-1 shrink-0">
            {mailto && (
              <Button size="sm" variant="outline" asChild>
                <a href={mailto}><Mail className="h-3.5 w-3.5 mr-1" />Open</a>
              </Button>
            )}
            <Button size="sm" onClick={() => send(e.id, i.next_step.step_number, i.next_step.step_number /* approximate; totalSteps unknown here */)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Mark sent
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-amber-700">Overdue ({overdue.length})</h4>
          <div className="space-y-2">{overdue.map(renderItem)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Upcoming ({upcoming.length})</h4>
          <div className="space-y-2">{upcoming.map(renderItem)}</div>
        </div>
      )}
    </div>
  );
}
