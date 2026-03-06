import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ExternalLink, Video, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  tag: string;
  loom_url?: string | null;
  company_id: string;
}

const TAG_STYLES: Record<string, string> = {
  feature: "bg-primary/10 text-primary border-primary/30",
  improvement: "bg-blue-500/10 text-blue-700 border-blue-300",
  fix: "bg-amber-500/10 text-amber-700 border-amber-300",
};

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupByMonth(entries: ChangelogEntry[]) {
  const groups: Record<string, ChangelogEntry[]> = {};
  for (const entry of entries) {
    const label = getMonthLabel(entry.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }
  return Object.entries(groups);
}

function useChangelogEntries() {
  return useQuery({
    queryKey: ["changelog-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("changelog_entries")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ChangelogEntry[];
    },
  });
}

interface EntryFormData {
  date: string;
  title: string;
  description: string;
  tag: string;
  loom_url: string;
}

const EMPTY_FORM: EntryFormData = { date: new Date().toISOString().slice(0, 10), title: "", description: "", tag: "feature", loom_url: "" };

function EntryDialog({ open, onOpenChange, entry, companyId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry?: ChangelogEntry | null;
  companyId: string;
}) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [form, setForm] = useState<EntryFormData>(
    entry ? { date: entry.date, title: entry.title, description: entry.description, tag: entry.tag, loom_url: entry.loom_url || "" } : EMPTY_FORM
  );

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: companyId,
        date: form.date,
        title: form.title,
        description: form.description,
        tag: form.tag,
        loom_url: form.loom_url || null,
        created_by: session?.user?.id || null,
      };
      if (entry) {
        const { error } = await supabase.from("changelog_entries").update(payload as any).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("changelog_entries").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changelog-entries"] });
      toast.success(entry ? "Entry updated" : "Entry added");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Entry" : "Add Changelog Entry"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Tag</Label>
              <Select value={form.tag} onValueChange={(v) => setForm({ ...form, tag: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="improvement">Improvement</SelectItem>
                  <SelectItem value="fix">Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Feature name" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What changed?" rows={3} />
          </div>
          <div>
            <Label>Loom URL (optional)</Label>
            <Input value={form.loom_url} onChange={(e) => setForm({ ...form, loom_url: e.target.value })} placeholder="https://www.loom.com/share/..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => upsert.mutate()} disabled={!form.title || !form.date || upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {entry ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntryRow({ entry, isAdmin }: { entry: ChangelogEntry; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("changelog_entries").delete().eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changelog-entries"] });
      toast.success("Entry deleted");
    },
  });

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-start gap-4 p-4 text-left hover:bg-muted/40 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-20 shrink-0">
            {entry.date}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="font-medium text-sm">{entry.title}</p>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TAG_STYLES[entry.tag] || ""}`}>
                {entry.tag}
              </Badge>
              {entry.loom_url && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-600 border-rose-300 gap-1">
                  <Video className="h-2.5 w-2.5" /> Loom
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{entry.description}</p>
          </div>
          <div className="shrink-0 mt-0.5 text-muted-foreground flex items-center gap-1">
            {isAdmin && (
              <>
                <span
                  role="button"
                  className="p-1 hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </span>
                <span
                  role="button"
                  className="p-1 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); if (confirm("Delete this entry?")) deleteMut.mutate(); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </>
            )}
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
            {entry.loom_url ? (
              <a
                href={entry.loom_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Video className="h-4 w-4" />
                Watch walkthrough video
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No walkthrough video recorded yet — check back soon.
              </p>
            )}
          </div>
        )}
      </div>

      {editing && (
        <EntryDialog
          open={editing}
          onOpenChange={setEditing}
          entry={entry}
          companyId={entry.company_id}
        />
      )}
    </>
  );
}

export function WhatsNew() {
  const { data: entries, isLoading } = useChangelogEntries();
  const { isAdmin } = usePermissions();
  const [addOpen, setAddOpen] = useState(false);

  const groups = groupByMonth(entries || []);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Auto-collapse all but first month when data loads
  const firstMonth = groups[0]?.[0];

  const toggleMonth = (label: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading changelog…
      </div>
    );
  }

  const companyId = entries?.[0]?.company_id || "";

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Entry
          </Button>
        </div>
      )}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No changelog entries yet.</p>
      )}

      {groups.map(([month, monthEntries]) => {
        const isCollapsed = month !== firstMonth && collapsedMonths.has(month) || (month !== firstMonth && !collapsedMonths.has(month) && !collapsedMonths.has("__init"));
        // Simple: first month always open, rest collapsed by default
        const collapsed = month !== firstMonth;
        const isOpen = month === firstMonth || collapsedMonths.has(month);

        return (
          <div key={month} className="space-y-2">
            <button
              className="flex items-center gap-2 w-full group"
              onClick={() => toggleMonth(month)}
            >
              {isOpen
                ? <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              }
              <h3 className="text-sm font-semibold text-foreground">{month}</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{monthEntries.length}</Badge>
            </button>

            {isOpen && (
              <div className="space-y-1.5 ml-6">
                {monthEntries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} isAdmin={isAdmin} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {addOpen && companyId && (
        <EntryDialog open={addOpen} onOpenChange={setAddOpen} companyId={companyId} />
      )}
    </div>
  );
}
