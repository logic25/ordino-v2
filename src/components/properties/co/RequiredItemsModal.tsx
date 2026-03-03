import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, Plus, Trash2, ChevronDown, ChevronUp, ClipboardList, Download,
} from "lucide-react";
import type { BISOpenItem } from "./coMockData";
import { type RequiredItem, PHASE_LABELS, PHASE_COLORS, createDefaultRequiredItems } from "./requiredItemsData";

interface RequiredItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RequiredItem[];
  onItemsChange: (items: RequiredItem[]) => void;
  jobNum: string;
}

type StatusFilter = "All" | "Outstanding" | "Received" | "Waived";

export function RequiredItemsModal({ open, onOpenChange, items, onItemsChange, jobNum }: RequiredItemsModalProps) {
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<"All" | "APP" | "PER" | "SGN">("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New custom item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhase, setNewPhase] = useState<"APP" | "PER" | "SGN">("PER");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (phaseFilter !== "All" && item.phase !== phaseFilter) return false;
      if (statusFilter === "Outstanding" && (item.dateReceived || item.waived)) return false;
      if (statusFilter === "Received" && !item.dateReceived) return false;
      if (statusFilter === "Waived" && !item.waived) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.receivedFrom.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, phaseFilter, statusFilter, search]);

  const updateItem = (id: string, updates: Partial<RequiredItem>) => {
    onItemsChange(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(i => i.id !== id));
  };

  const addCustomItem = () => {
    if (!newName.trim()) return;
    const newItem: RequiredItem = {
      id: `req-custom-${Date.now()}`,
      name: newName.trim(),
      phase: newPhase,
      receivedFrom: "",
      notes: "",
      dateRequested: null,
      dateReceived: null,
      waived: false,
    };
    onItemsChange([...items, newItem]);
    setNewName("");
    setShowAddForm(false);
  };

  const loadBScanTemplate = () => {
    const defaults = createDefaultRequiredItems();
    // Only add items that aren't already in the list (by name)
    const existingNames = new Set(items.map(i => i.name.toLowerCase()));
    const newItems = defaults.filter(d => !existingNames.has(d.name.toLowerCase()));
    onItemsChange([...items, ...newItems]);
  };

  const stats = useMemo(() => {
    const total = items.length;
    const received = items.filter(i => i.dateReceived).length;
    const waived = items.filter(i => i.waived && !i.dateReceived).length;
    const outstanding = total - received - waived;
    return { total, received, waived, outstanding };
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Required Items — Job #{jobNum}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              {stats.received}/{stats.total} received
            </Badge>
            {stats.outstanding > 0 && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 text-xs">
                {stats.outstanding} outstanding
              </Badge>
            )}
            {stats.waived > 0 && (
              <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                {stats.waived} waived
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>

          <div className="flex gap-1">
            {(["All", "APP", "PER", "SGN"] as const).map((p) => (
              <Button key={p} variant={phaseFilter === p ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setPhaseFilter(p)}>
                {p === "All" ? "All Phases" : PHASE_LABELS[p]}
              </Button>
            ))}
          </div>

          <div className="flex gap-1">
            {(["All", "Outstanding", "Received", "Waived"] as const).map((s) => (
              <Button key={s} variant={statusFilter === s ? "secondary" : "ghost"} size="sm" className="h-7 text-xs" onClick={() => setStatusFilter(s)}>
                {s}
              </Button>
            ))}
          </div>

          <div className="flex gap-1 ml-auto">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
            {items.length === 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={loadBScanTemplate}>
                <Download className="h-3.5 w-3.5" /> Load B-SCAN Template
              </Button>
            )}
            {items.length > 0 && items.length < 20 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={loadBScanTemplate}>
                <Download className="h-3.5 w-3.5" /> + B-SCAN Items
              </Button>
            )}
          </div>
        </div>

        {/* Add custom item form */}
        {showAddForm && (
          <div className="rounded-lg border border-dashed p-3 flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Item Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Client affidavit of completion" className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && addCustomItem()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phase</Label>
              <select className="h-8 rounded-md border bg-background px-2 text-sm" value={newPhase} onChange={(e) => setNewPhase(e.target.value as any)}>
                <option value="APP">Application</option>
                <option value="PER">Permit</option>
                <option value="SGN">Sign-Off</option>
              </select>
            </div>
            <Button size="sm" className="h-8" onClick={addCustomItem} disabled={!newName.trim()}>Add</Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-12">Phase</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-[130px]">From</TableHead>
                <TableHead className="w-[110px]">Requested</TableHead>
                <TableHead className="w-[110px]">Received</TableHead>
                <TableHead className="w-[60px]">Status</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const isExpanded = expandedId === item.id;
                const status = item.dateReceived ? "received" : item.waived ? "waived" : "outstanding";
                return (
                  <>
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer hover:bg-accent/5 ${status === "received" ? "opacity-60" : status === "waived" ? "opacity-40" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <TableCell className="p-1">
                        <Checkbox
                          checked={!!item.dateReceived}
                          onCheckedChange={(checked) => {
                            updateItem(item.id, { dateReceived: checked ? new Date().toISOString().slice(0, 10) : null });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Badge variant="outline" className={`${PHASE_COLORS[item.phase]} text-[9px] px-1 py-0`}>
                          {item.phase}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-sm ${item.dateReceived ? "line-through" : ""}`}>
                        {item.name}
                        {item.notes && <span className="ml-2 text-muted-foreground text-xs">💬</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.receivedFrom || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.dateRequested || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.dateReceived || "—"}</TableCell>
                      <TableCell>
                        {status === "received" && <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-[9px]">✓</Badge>}
                        {status === "waived" && <Badge variant="outline" className="bg-muted text-muted-foreground text-[9px]">W</Badge>}
                        {status === "outstanding" && <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 text-[9px]">—</Badge>}
                      </TableCell>
                      <TableCell className="p-1">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <TableRow key={`${item.id}-expanded`} className="bg-muted/5">
                        <TableCell colSpan={8} className="p-3">
                          <div className="grid grid-cols-2 gap-3 max-w-2xl">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">From (who we need it from)</Label>
                              <Input
                                value={item.receivedFrom}
                                onChange={(e) => updateItem(item.id, { receivedFrom: e.target.value })}
                                placeholder="DOB, Architect, GC, Client..."
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Sign-Off Required</Label>
                              <Input
                                value={(item as any).signOffRequired || ""}
                                onChange={(e) => updateItem(item.id, { ...item, signOffRequired: e.target.value } as any)}
                                placeholder="FDNY, DOB, Owner..."
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Date Requested (when we asked)</Label>
                              <Input
                                type="date"
                                value={item.dateRequested || ""}
                                onChange={(e) => updateItem(item.id, { dateRequested: e.target.value || null })}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Date Received (when we got it)</Label>
                              <Input
                                type="date"
                                value={item.dateReceived || ""}
                                onChange={(e) => updateItem(item.id, { dateReceived: e.target.value || null })}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Notes</Label>
                              <Textarea
                                value={item.notes}
                                onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                                rows={2}
                                placeholder="Follow-up details, context..."
                                className="text-xs"
                              />
                            </div>
                            <div className="col-span-2 flex items-center gap-2">
                              <Button
                                variant={item.waived ? "secondary" : "ghost"}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => updateItem(item.id, { waived: !item.waived })}
                              >
                                {item.waived ? "Waived ✓ — Click to un-waive" : "Mark as Waived"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive gap-1 ml-auto"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="h-3 w-3" /> Remove
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {items.length === 0 ? (
                      <div className="space-y-2">
                        <p>No required items yet.</p>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={loadBScanTemplate}>
                          <Download className="h-3.5 w-3.5" /> Load B-SCAN Template
                        </Button>
                        <p className="text-xs">or add items manually</p>
                      </div>
                    ) : (
                      "No items match your filters."
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
