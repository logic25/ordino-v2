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
  type DragEndEvent, DragOverlay, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, GripVertical, MoreHorizontal, Pencil, Trash2,
  AlertTriangle, Clock, Lightbulb, CheckCircle2, Rocket,
  ArrowRight, Inbox, LayoutGrid, List, Brain, Sparkles, ChevronRight, AlertCircle,
} from "lucide-react";
import { AIRoadmapIntake } from "./AIRoadmapIntake";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
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
  const [aiIntakeOpen, setAiIntakeOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [form, setForm] = useState({ title: "", description: "", category: "general", status: "gap", priority: "medium" });

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

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, ...form });
    } else {
      createMutation.mutate(form);
    }
    setDialogOpen(false);
    setEditingItem(null);
    setForm({ title: "", description: "", category: "general", status: "gap", priority: "medium" });
  };

  const handleEdit = (item: RoadmapItem) => {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description, category: item.category, status: item.status, priority: item.priority });
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
            <Brain className="h-3.5 w-3.5" />
            AI Intake
          </Button>
          <Button size="sm" onClick={() => {
            setEditingItem(null);
            setForm({ title: "", description: "", category: "general", status: "gap", priority: "medium" });
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Feature name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Explain what this is and why it matters..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="h-8 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI Stress-Test Panel */}
            {editingItem?.stress_test_result && (() => {
              const ai = editingItem.stress_test_result!;
              return (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-violet-500" />
                      <p className="text-sm font-medium">AI Analysis</p>
                      {editingItem.stress_tested_at && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(editingItem.stress_tested_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="rounded-md bg-muted/50 border px-3 py-2">
                      <p className="text-[10px] text-muted-foreground font-medium mb-0.5 uppercase tracking-wide">Evidence</p>
                      <p className="text-xs leading-relaxed">{ai.evidence}</p>
                    </div>
                    {ai.duplicate_warning && (
                      <div className="rounded-md border border-amber-300 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-amber-700 font-medium mb-0.5">Similar item exists</p>
                          <p className="text-xs text-amber-700">"{ai.duplicate_warning}"</p>
                        </div>
                      </div>
                    )}
                    {ai.challenges?.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Implementation challenges</p>
                        <ul className="space-y-1">
                          {ai.challenges.map((c, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                              {c}
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
          <DialogFooter>
            <Button onClick={handleSave} disabled={!form.title.trim()}>
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
