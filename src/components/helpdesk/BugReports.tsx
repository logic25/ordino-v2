import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, CheckCircle2, Plus, Clock, Filter, ArrowUpDown, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const PAGES = [
  "Dashboard", "Projects", "Properties", "Proposals", "Invoices / Billing",
  "Time", "Email", "Calendar", "RFPs", "Reports", "Companies / Clients",
  "Documents", "Settings", "Auth / Login", "Help Center", "Other",
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const statusIcon = (status: string) => {
  if (status === "resolved") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "in_progress") return <Clock className="h-4 w-4 text-amber-500" />;
  return <Bug className="h-4 w-4 text-destructive" />;
};

const priorityVariant = (p: string) =>
  p === "critical" || p === "high" ? "destructive" as const : "secondary" as const;

export function BugReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useCompanyProfiles();
  const { data: userRoles = [] } = useUserRoles();
  const isAdmin = userRoles.some((r: any) => r.role === "admin");

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "priority">("newest");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState("");
  const [action, setAction] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [priority, setPriority] = useState("medium");

  // Detail sheet
  const [selectedBug, setSelectedBug] = useState<any>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editAssignee, setEditAssignee] = useState("");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["bug-reports", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from("feature_requests")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("category", "bug_report")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Stats
  const openCount = reports.filter((r: any) => r.status === "open").length;
  const inProgressCount = reports.filter((r: any) => r.status === "in_progress").length;
  const resolvedCount = reports.filter((r: any) => r.status === "resolved").length;
  const criticalCount = reports.filter((r: any) => r.priority === "critical" && r.status !== "resolved").length;

  // Filter + sort
  const filtered = reports
    .filter((r: any) => statusFilter === "all" || r.status === statusFilter)
    .filter((r: any) => priorityFilter === "all" || r.priority === priorityFilter)
    .sort((a: any, b: any) => {
      if (sortBy === "priority") return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const submitBug = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !profile?.id) throw new Error("No company");
      const description = `**Page:** ${page}\n**Action:** ${action}\n**Expected:** ${expected}\n**Actual:** ${actual}`;
      const { error } = await supabase.from("feature_requests").insert({
        company_id: profile.company_id,
        user_id: profile.id,
        title: `[${page}] ${action.slice(0, 80)}`,
        description,
        category: "bug_report",
        priority,
        status: "open",
      });
      if (error) throw error;

      // Fire email alert (best-effort, don't block on failure)
      supabase.functions.invoke("send-bug-alert", {
        body: {
          bug_title: `[${page}] ${action.slice(0, 80)}`,
          bug_description: description,
          bug_priority: priority,
          company_id: profile.company_id,
          reporter_name: profile.display_name || `${profile.first_name} ${profile.last_name}`,
        },
      }).catch(() => {});
    },
    onSuccess: () => {
      toast({ title: "Bug report submitted", description: "Team members have been notified." });
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
      setShowForm(false);
      setPage(""); setAction(""); setExpected(""); setActual(""); setPriority("medium");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateBug = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("feature_requests")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Bug updated" });
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteBug = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feature_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Bug deleted" });
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
      setSelectedBug(null);
    },
  });

  const openDetail = (bug: any) => {
    setSelectedBug(bug);
    setEditNotes(bug.admin_notes || "");
    setEditStatus(bug.status || "open");
    setEditAssignee(bug.assigned_to || "");
  };

  const saveDetail = () => {
    if (!selectedBug) return;
    const updates: Record<string, any> = {
      status: editStatus,
      admin_notes: editNotes || null,
      assigned_to: editAssignee || null,
    };
    if (editStatus === "resolved" && selectedBug.status !== "resolved") {
      updates.resolved_at = new Date().toISOString();
    }
    if (editStatus !== "resolved") {
      updates.resolved_at = null;
    }
    updateBug.mutate({ id: selectedBug.id, updates }, {
      onSuccess: () => setSelectedBug(null),
    });
  };

  const getAssigneeName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((pr) => pr.id === id);
    return p ? p.display_name || `${p.first_name} ${p.last_name}` : "—";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Bug Reports</h2>
          <p className="text-sm text-muted-foreground">Track, assign, and resolve issues.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Report Bug
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Open", count: openCount, color: "text-destructive" },
          { label: "In Progress", count: inProgressCount, color: "text-amber-500" },
          { label: "Resolved", count: resolvedCount, color: "text-green-500" },
          { label: "Critical", count: criticalCount, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-3 px-4 text-center">
              <p className={cn("text-2xl font-bold", s.color)}>{s.count}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit form */}
      {showForm && (
        <Card>
          <CardContent className="py-4 px-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Bug className="h-4 w-4" />
              <span className="font-semibold text-sm">New Bug Report</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Page / Area</Label>
                <Select value={page} onValueChange={setPage}>
                  <SelectTrigger><SelectValue placeholder="Select page..." /></SelectTrigger>
                  <SelectContent>
                    {PAGES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>What did you do?</Label>
              <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Clicked 'Add Service' button" />
            </div>
            <div className="space-y-2">
              <Label>What should have happened?</Label>
              <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Expected behavior..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>What actually happened?</Label>
              <Textarea value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Actual behavior..." rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" disabled={!page || !action || !expected || !actual || submitBug.isPending} onClick={() => submitBug.mutate()}>
                {submitBug.isPending ? "Submitting..." : "Submit Bug Report"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No bug reports found.</p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-24">Priority</TableHead>
                <TableHead className="w-32">Assigned To</TableHead>
                <TableHead className="w-24">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((bug: any) => (
                <TableRow key={bug.id} className="cursor-pointer" onClick={() => openDetail(bug)}>
                  <TableCell>{statusIcon(bug.status)}</TableCell>
                  <TableCell>
                    <span className="font-medium text-sm">{bug.title}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(bug.priority)} className="text-xs">{bug.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getAssigneeName(bug.assigned_to)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(bug.created_at), "MMM d")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedBug} onOpenChange={(open) => !open && setSelectedBug(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedBug && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {statusIcon(selectedBug.status)}
                  <span className="truncate">{selectedBug.title}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                {/* Description */}
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <div className="mt-1 text-sm whitespace-pre-line bg-muted/50 rounded-md p-3">
                    {selectedBug.description}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <div className="mt-1">
                      <Badge variant={priorityVariant(selectedBug.priority)}>{selectedBug.priority}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Reported</Label>
                    <p className="mt-1 text-sm">{format(new Date(selectedBug.created_at), "MMM d, yyyy")}</p>
                  </div>
                </div>

                {isAdmin && (
                  <>
                    <div className="border-t pt-4 space-y-4">
                      <h4 className="font-semibold text-sm">Management</h4>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={editStatus} onValueChange={setEditStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Assign To</Label>
                        <Select value={editAssignee} onValueChange={setEditAssignee}>
                          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {profiles.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.display_name || `${p.first_name} ${p.last_name}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Admin Notes</Label>
                        <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Internal notes or resolution summary..." rows={3} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveDetail} disabled={updateBug.isPending}>
                          {updateBug.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          if (confirm("Delete this bug report?")) deleteBug.mutate(selectedBug.id);
                        }}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {selectedBug.admin_notes && !isAdmin && (
                  <div className="border-t pt-4">
                    <Label className="text-xs text-muted-foreground">Resolution Notes</Label>
                    <p className="mt-1 text-sm whitespace-pre-line">{selectedBug.admin_notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
