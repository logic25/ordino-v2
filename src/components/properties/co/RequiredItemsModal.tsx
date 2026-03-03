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
  Search, Plus, Trash2, ChevronDown, ChevronUp, ClipboardList,
} from "lucide-react";
import type { RequiredItem } from "./requiredItemsData";

interface RequiredItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RequiredItem[];
  onItemsChange: (items: RequiredItem[]) => void;
  jobNum: string;
}

export function RequiredItemsModal({ open, onOpenChange, items, onItemsChange, jobNum }: RequiredItemsModalProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) =>
      item.name.toLowerCase().includes(q) || item.receivedFrom.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q)
    );
  }, [items, search]);

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
      phase: "PER",
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

  const completedCount = items.filter(i => i.dateReceived).length;
  const outstandingCount = items.length - completedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Required Items — Job #{jobNum}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              {completedCount}/{items.length} received
            </Badge>
            {outstandingCount > 0 && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 text-xs">
                {outstandingCount} outstanding
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
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-3.5 w-3.5" /> Add Item
          </Button>
        </div>

        {/* Add custom item form */}
        {showAddForm && (
          <div className="rounded-lg border border-dashed p-3 flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Item Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Letter of Completion, Cost Affidavit..." className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && addCustomItem()} />
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
                <TableHead>Item</TableHead>
                <TableHead className="w-[160px]">Responsible Party</TableHead>
                <TableHead className="w-[60px]">Status</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const isExpanded = expandedId === item.id;
                const done = !!item.dateReceived;
                return (
                  <>
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer hover:bg-accent/5 ${done ? "opacity-60" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <TableCell className="p-1">
                        <Checkbox
                          checked={done}
                          onCheckedChange={(checked) => {
                            updateItem(item.id, { dateReceived: checked ? new Date().toISOString().slice(0, 10) : null });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className={`text-sm ${done ? "line-through" : ""}`}>
                        {item.name}
                        {item.notes && <span className="ml-2 text-muted-foreground text-xs">💬</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.receivedFrom || "—"}</TableCell>
                      <TableCell>
                        {done
                          ? <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-[9px]">✓</Badge>
                          : <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 text-[9px]">—</Badge>
                        }
                      </TableCell>
                      <TableCell className="p-1">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${item.id}-expanded`} className="bg-muted/5">
                        <TableCell colSpan={5} className="p-3">
                          <div className="grid grid-cols-2 gap-3 max-w-2xl">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Responsible Party</Label>
                              <Input
                                value={item.receivedFrom}
                                onChange={(e) => updateItem(item.id, { receivedFrom: e.target.value })}
                                placeholder="DOB, Architect, GC, Client..."
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Date Received</Label>
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
                            <div className="col-span-2 flex items-center">
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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {items.length === 0 ? (
                      <div className="space-y-2">
                        <p>No required items yet.</p>
                        <p className="text-xs">Click "Add Item" to get started</p>
                      </div>
                    ) : (
                      "No items match your search."
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
