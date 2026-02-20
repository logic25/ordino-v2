import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, GripVertical, MoreHorizontal, Pencil, Trash2,
  AlertTriangle, Clock, Lightbulb, CheckCircle2, Rocket,
  ArrowRight, Inbox, LayoutGrid, List, Brain, Sparkles, ChevronRight, AlertCircle, Loader2,
  BarChart2,
} from "lucide-react";
import { AIRoadmapIntake } from "./AIRoadmapIntake";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Types
interface StressTestResult {
  title: string;
  description: string;
  category: string;
  priority: string;
  evidence: string;
  duplicate_warning: string | null;
  challenges: string[];
}

interface RoadmapItem {
  id: string;
  company_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  sort_order: number;
  feature_request_id: string | null;
  stress_test_result: StressTestResult | null;
  stress_tested_at: string | null;
  created_at: string;
}

type RoadmapStatus = "gap" | "planned" | "in_progress" | "done";

const STATUSES: { key: RoadmapStatus; label: string; icon: React.ElementType; color: string }[] = [
  { key: "gap", label: "Known Gaps", icon: AlertTriangle, color: "text-destructive" },
  { key: "planned", label: "Planned", icon: Lightbulb, color: "text-blue-600" },
  { key: "in_progress", label: "In Progress", icon: Clock, color: "text-amber-600" },
  { key: "done", label: "Done", icon: CheckCircle2, color: "text-green-600" },
];

const CATEGORIES = ["billing", "projects", "integrations", "security", "documents", "operations", "general"];
const PRIORITIES = ["high", "medium", "low"];

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-300",
  low: "bg-muted text-muted-foreground border-border",
};

// Hook
function useRoadmapItems() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["roadmap-items", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roadmap_items")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RoadmapItem[];
    },
  });
}

function useFeatureRequestsForPromotion() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["feature-requests-for-roadmap", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("id, title, description, category, priority")
        .order("upvotes", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// Sortable Card
function SortableRoadmapCard({
  item, onEdit, onDelete, onStatusChange,
}: {
  item: RoadmapItem;
  onEdit: (item: RoadmapItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="group cursor-pointer hover:shadow-md transition-shadow" onClick={() => onEdit(item)}>
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-start gap-1.5">
            <button {...listeners} className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground shrink-0">
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight">{item.title}</p>
              {item.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(item)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                {STATUSES.filter((s) => s.key !== item.status).map((s) => (
                  <DropdownMenuItem key={s.key} onClick={() => onStatusChange(item.id, s.key)}>
                    <ArrowRight className="h-3.5 w-3.5 mr-2" /> Move to {s.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{item.category}</Badge>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_STYLES[item.priority] || ""}`}>
              {item.priority}
            </Badge>
            {item.feature_request_id && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
                From request
              </Badge>
            )}
            {item.stress_tested_at && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-600 border-violet-300 dark:text-violet-400 dark:border-violet-700 gap-1">
                <Sparkles className="h-2.5 w-2.5" /> AI tested
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Component
export function ProductRoadmap() {
  const { data: items = [], isLoading } = useRoadmapItems();
  const { data: featureRequests = [] } = useFeatureRequestsForPromotion();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"quick" | "ai">("quick");
  const [aiIntakeOpen, setAiIntakeOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [form, setForm] = useState({ title: "", description: "", category: "general", status: "gap", priority: "medium" });
  const [stressTesting, setStressTesting] = useState(false);

  // AI Stress-Test for new item (Add dialog)
  const [aiIdeaText, setAiIdeaText] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<StressTestResult | null>(null);
  const [aiForm, setAiForm] = useState({ status: "gap", priority: "medium", category: "general" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const companyId = (profile as any)?.company_id;

  // Already-promoted feature request IDs
  const promotedIds = new Set(items.filter((i) => i.feature_request_id).map((i) => i.feature_request_id));
  const unpromotedRequests = featureRequests.filter((r: any) => !promotedIds.has(r.id));

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; category: string; status: string; priority: string; feature_request_id?: string }) => {
      const maxOrder = items.filter((i) => i.status === data.status).reduce((m, i) => Math.max(m, i.sort_order), 0);
      const { error } = await supabase.from("roadmap_items").insert({
        company_id: companyId,
        created_by: (profile as any)?.id,
        sort_order: maxOrder + 1,
        ...data,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
      toast({ title: "Roadmap item added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("roadmap_items").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roadmap_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
      toast({ title: "Item removed" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm({ title: "", description: "", category: "general", status: "gap", priority: "medium" });
    setAiIdeaText("");
    setAiResult(null);
    setAiForm({ status: "gap", priority: "medium", category: "general" });
    setDialogTab("quick");
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...form });
    } else {
      createMutation.mutate(form);
    }
    closeDialog();
  };

  const handleAddAiResult = async () => {
    if (!aiResult) return;
    const maxOrder = items.filter((i) => i.status === aiForm.status).reduce((m, i) => Math.max(m, i.sort_order), 0);
    const { error } = await supabase.from("roadmap_items").insert({
      company_id: companyId,
      created_by: (profile as any)?.id,
      title: aiResult.title,
      description: aiResult.description,
      category: aiForm.category,
      status: aiForm.status,
      priority: aiForm.priority,
      sort_order: maxOrder + 1,
      stress_test_result: aiResult as any,
      stress_tested_at: new Date().toISOString(),
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
    toast({ title: "Added to roadmap", description: aiResult.title });
    closeDialog();
  };

  const handleAnalyzeNewIdea = async () => {
    if (!aiIdeaText.trim()) return;
    setAiAnalyzing(true);
    setAiResult(null);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = (await supabase.auth.getSession()).data.session?.access_token || "";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: ANON_KEY },
        body: JSON.stringify({ mode: "idea", company_id: companyId, raw_idea: aiIdeaText.trim() }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();
      const suggestion = result.suggestions?.[0];
      if (!suggestion) throw new Error("No analysis returned");
      setAiResult(suggestion);
      setAiForm({ status: "gap", priority: suggestion.priority || "medium", category: suggestion.category || "general" });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleStressTest = async () => {
    if (!editingItem) return;
    setStressTesting(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = (await supabase.auth.getSession()).data.session?.access_token || "";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: ANON_KEY },
        body: JSON.stringify({ mode: "idea", company_id: companyId, raw_idea: `${form.title}: ${form.description}`, exclude_item_id: editingItem.id }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const result = await res.json();
      const suggestion = result.suggestions?.[0];
      if (!suggestion) throw new Error("No analysis returned");
      const testedAt = new Date().toISOString();
      await supabase.from("roadmap_items").update({ stress_test_result: suggestion as any, stress_tested_at: testedAt } as any).eq("id", editingItem.id);
      setEditingItem({ ...editingItem, stress_test_result: suggestion, stress_tested_at: testedAt });
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
      toast({ title: "AI stress test complete", description: "Analysis saved to this roadmap item." });
    } catch (err: any) {
      toast({ title: "Stress test failed", description: err.message, variant: "destructive" });
    } finally {
      setStressTesting(false);
    }
  };

  const handleEdit = (item: RoadmapItem) => {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description, category: item.category, status: item.status, priority: item.priority });
    setDialogTab("quick");
    setDialogOpen(true);
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    const maxOrder = items.filter((i) => i.status === newStatus).reduce((m, i) => Math.max(m, i.sort_order), 0);
    updateMutation.mutate({ id, status: newStatus, sort_order: maxOrder + 1 });
  };

  const handlePromote = (req: any) => {
    createMutation.mutate({
      title: req.title,
      description: req.description || "",
      category: req.category || "general",
      status: "planned",
      priority: req.priority || "medium",
      feature_request_id: req.id,
    });
    setPromoteOpen(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find which column both items are in
    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);
    if (!activeItem || !overItem || activeItem.status !== overItem.status) return;

    const columnItems = items.filter((i) => i.status === activeItem.status).sort((a, b) => a.sort_order - b.sort_order);
    const oldIndex = columnItems.findIndex((i) => i.id === active.id);
    const newIndex = columnItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(columnItems, oldIndex, newIndex);

    // Update sort orders
    reordered.forEach((item, idx) => {
      if (item.sort_order !== idx) {
        updateMutation.mutate({ id: item.id, sort_order: idx });
      }
    });
  };

  if (isLoading) return <div className="text-muted-foreground text-sm py-8 text-center">Loading roadmap...</div>;

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            {viewMode === "kanban" ? "Drag cards to reorder. Use the menu to move between columns." : "Click column headers to sort. Use actions to edit or move items."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="sm" className="h-7 px-2 rounded-r-none" onClick={() => setViewMode("kanban")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" className="h-7 px-2 rounded-l-none" onClick={() => setViewMode("table")}>
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          {unpromotedRequests.length > 0 && (
            <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Inbox className="h-4 w-4 mr-1" /> From Requests ({unpromotedRequests.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Promote Feature Request to Roadmap</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {unpromotedRequests.map((req: any) => (
                    <Card key={req.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handlePromote(req)}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{req.title}</p>
                            {req.description && <p className="text-xs text-muted-foreground line-clamp-1">{req.description}</p>}
                          </div>
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAiIntakeOpen(true)}
            className="gap-1.5"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Analyze Behavior
          </Button>
          <Button size="sm" onClick={() => {
            setEditingItem(null);
            setForm({ title: "", description: "", category: "general", status: "gap", priority: "medium" });
            setAiIdeaText("");
            setAiResult(null);
            setDialogTab("quick");
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        /* Table View */
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...items]
                .sort((a, b) => {
                  const statusOrder = ["gap", "in_progress", "planned", "done"];
                  const si = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
                  if (si !== 0) return si;
                  const pi = ["high", "medium", "low"].indexOf(a.priority) - ["high", "medium", "low"].indexOf(b.priority);
                  return pi;
                })
                .map((item) => {
                  const statusConf = STATUSES.find((s) => s.key === item.status);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-sm max-w-[200px]">{item.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[350px]">
                        <p className="line-clamp-2">{item.description}</p>
                      </TableCell>
                      <TableCell>
                        <Select value={item.status} onValueChange={(v) => handleStatusChange(item.id, v)}>
                          <SelectTrigger className="h-7 w-[120px] text-xs border-none bg-transparent shadow-none p-0 px-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] capitalize">{item.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[item.priority] || ""}`}>{item.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(item)}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No roadmap items yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUSES.map((col) => {
            const StatusIcon = col.icon;
            const columnItems = items.filter((i) => i.status === col.key).sort((a, b) => a.sort_order - b.sort_order);

            return (
              <div key={col.key} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <StatusIcon className={`h-4 w-4 ${col.color}`} />
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{columnItems.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px] p-2 rounded-lg bg-muted/30 border border-dashed border-border">
                  <SortableContext items={columnItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {columnItems.map((item) => (
                      <SortableRoadmapCard
                        key={item.id}
                        item={item}
                        onEdit={handleEdit}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                  </SortableContext>
                  {columnItems.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No items</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DndContext>
      )}

      {/* AI Intake Modal */}
      {companyId && (
        <AIRoadmapIntake
          open={aiIntakeOpen}
          onOpenChange={setAiIntakeOpen}
          companyId={companyId}
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingItem ? "Edit Roadmap Item" : "Add Roadmap Item"}
              {editingItem?.stress_tested_at && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-600 border-violet-300 dark:text-violet-400 dark:border-violet-700 gap-1 font-normal">
                  <Sparkles className="h-2.5 w-2.5" /> AI stress-tested
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {editingItem ? (
            /* ── Editing existing item: standard form + re-run AI ── */
            <>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Feature name" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explain what this is and why it matters..." rows={3} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* AI Analysis Panel */}
                {editingItem.stress_test_result && (() => {
                  const ai = editingItem.stress_test_result!;
                  return (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-violet-600" />
                          <p className="text-sm font-medium">AI Analysis</p>
                          {editingItem.stress_tested_at && (
                            <span className="text-[10px] text-muted-foreground ml-auto">{new Date(editingItem.stress_tested_at).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div className="rounded-md bg-muted/50 border px-3 py-2">
                          <p className="text-[10px] text-muted-foreground font-medium mb-0.5 uppercase tracking-wide">Evidence</p>
                          <p className="text-xs leading-relaxed">{ai.evidence}</p>
                        </div>
                        {ai.duplicate_warning && (
                          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 flex items-start gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[10px] text-foreground font-medium mb-0.5">Similar item exists</p>
                              <p className="text-xs text-muted-foreground">"{ai.duplicate_warning}"</p>
                            </div>
                          </div>
                        )}
                        {ai.challenges?.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Implementation challenges</p>
                            <ul className="space-y-1">
                              {ai.challenges.map((c, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />{c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              <DialogFooter className="flex items-center justify-between gap-2 flex-row">
                <Button variant="outline" size="sm" onClick={handleStressTest} disabled={stressTesting} className="gap-1.5 mr-auto">
                  {stressTesting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : <><Brain className="h-3.5 w-3.5" /> {editingItem.stress_tested_at ? "Re-run AI Test" : "Run AI Stress Test"}</>}
                </Button>
                <Button onClick={handleSave} disabled={!form.title.trim()}>Save Changes</Button>
              </DialogFooter>
            </>
          ) : (
            /* ── Adding new item: two-tab dialog ── */
            <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as "quick" | "ai")}>
              <TabsList className="w-full">
                <TabsTrigger value="quick" className="flex-1">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Quick Add
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex-1">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Stress-Test
                </TabsTrigger>
              </TabsList>

              {/* Quick Add Tab */}
              <TabsContent value="quick" className="space-y-4 mt-4">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Feature name" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explain what this is and why it matters..." rows={3} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={handleSave} disabled={!form.title.trim()}>Add Item</Button>
              </TabsContent>

              {/* AI Stress-Test Tab */}
              <TabsContent value="ai" className="space-y-4 mt-4">
                <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                  <p className="text-sm font-medium">How this works</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Describe your idea in plain English. AI refines it, scores priority, surfaces implementation challenges, and checks for duplicate roadmap items — then saves it pre-tagged with the analysis.
                  </p>
                </div>

                {!aiResult ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="e.g. Allow users to set up recurring invoices for retainer clients"
                      value={aiIdeaText}
                      onChange={(e) => setAiIdeaText(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <Button className="w-full" onClick={handleAnalyzeNewIdea} disabled={aiAnalyzing || !aiIdeaText.trim()}>
                      {aiAnalyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</> : <><Sparkles className="h-4 w-4 mr-2" /> Stress-Test This Idea</>}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Result preview */}
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] capitalize">{aiResult.category}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[aiResult.priority] || ""}`}>{aiResult.priority} priority</Badge>
                        {aiResult.duplicate_warning && (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
                            <AlertCircle className="h-2.5 w-2.5 mr-1" /> Similar exists
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-semibold">{aiResult.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{aiResult.description}</p>
                      <div className="rounded bg-muted/50 border px-2.5 py-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Evidence</p>
                        <p className="text-xs">{aiResult.evidence}</p>
                      </div>
                      {aiResult.duplicate_warning && (
                        <div className="rounded border border-border bg-muted/30 px-2.5 py-1.5 flex items-start gap-1.5">
                          <AlertCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">Similar: "{aiResult.duplicate_warning}"</p>
                        </div>
                      )}
                      {aiResult.challenges?.length > 0 && (
                        <ul className="space-y-0.5">
                          {aiResult.challenges.map((c, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />{c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Editable dropdowns before saving */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Status</Label>
                        <Select value={aiForm.status} onValueChange={(v) => setAiForm({ ...aiForm, status: v })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Category</Label>
                        <Select value={aiForm.category} onValueChange={(v) => setAiForm({ ...aiForm, category: v })}>
                          <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Select value={aiForm.priority} onValueChange={(v) => setAiForm({ ...aiForm, priority: v })}>
                          <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                          <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setAiResult(null); setAiIdeaText(""); }}>Try Again</Button>
                      <Button className="flex-1" onClick={handleAddAiResult}>
                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Add to Roadmap
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

