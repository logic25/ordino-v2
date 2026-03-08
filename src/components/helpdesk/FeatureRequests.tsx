import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ThumbsUp, Loader2, Rocket, Bot, Search, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from "@/hooks/useUserRoles";
import { format } from "date-fns";

function useFeatureRequests() {
  return useQuery({
    queryKey: ["feature-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("*")
        .neq("category", "bug_report")
        .order("upvotes", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-muted text-muted-foreground",
  under_review: "bg-blue-500/10 text-blue-700 border-blue-300",
  planned: "bg-primary/10 text-primary border-primary/30",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  completed: "bg-green-500/10 text-green-700 border-green-300",
  rejected: "bg-red-500/10 text-red-700 border-red-300",
};

const SOURCE_STYLES: Record<string, { label: string; className: string }> = {
  beacon: { label: "Beacon", className: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  manual: { label: "Manual", className: "bg-muted text-muted-foreground" },
};

export function FeatureRequests() {
  const { data: requests, isLoading } = useFeatureRequests();
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userRoles = [] } = useUserRoles();
  const isAdmin = userRoles.some((r: any) => r.role === "admin");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "beacon" | "manual">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("company_id").eq("user_id", session!.user.id).single();
      const { error } = await supabase.from("feature_requests").insert({
        company_id: prof!.company_id,
        user_id: session!.user.id,
        title,
        description,
        category,
        priority,
        source: "manual",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      toast({ title: "Request submitted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const req = requests?.find((r: any) => r.id === id);
      if (!req) return;
      const { error } = await supabase
        .from("feature_requests")
        .update({ upvotes: (req.upvotes || 0) + 1 })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
    },
  });

  const promoteToRoadmapMutation = useMutation({
    mutationFn: async (req: any) => {
      const { data: prof } = await supabase.from("profiles").select("company_id, id").eq("user_id", session!.user.id).single();
      // Create roadmap item linked to the feature request
      const { error: roadmapError } = await supabase.from("roadmap_items").insert({
        company_id: prof!.company_id,
        title: req.title,
        description: req.description || "",
        category: req.category || "general",
        priority: req.priority || "medium",
        status: "planned",
        feature_request_id: req.id,
        created_by: prof!.id,
      });
      if (roadmapError) throw roadmapError;

      // Update the feature request status to approved
      const { error: updateError } = await supabase
        .from("feature_requests")
        .update({ status: "approved" })
        .eq("id", req.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });
      toast({ title: "Promoted to roadmap", description: "Feature request has been added to the product roadmap." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("feature_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
    },
  });

  const q = search.toLowerCase();
  const filtered = (requests || []).filter((req: any) => {
    const matchesSearch = !q || req.title?.toLowerCase().includes(q) || req.description?.toLowerCase().includes(q);
    const matchesSource = sourceFilter === "all" || (req as any).source === sourceFilter;
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;
    return matchesSearch && matchesSource && matchesStatus;
  });

  const beaconCount = (requests || []).filter((r: any) => (r as any).source === "beacon").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search requests..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {(["all", "beacon", "manual"] as const).map((s) => (
              <Button
                key={s}
                variant={sourceFilter === s ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSourceFilter(s)}
              >
                {s === "all" ? "All" : SOURCE_STYLES[s].label}
                {s === "beacon" && beaconCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{beaconCount}</Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Submit Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Submit Feature Request</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description" /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed explanation..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="projects">Projects</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="proposals">Proposals</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="reports">Reports</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <p>No feature requests match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((req: any) => (
            <Card key={req.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center gap-0 h-auto py-1 px-2"
                  onClick={() => upvoteMutation.mutate(req.id)}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{req.upvotes || 0}</span>
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-medium text-sm">{req.title}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[req.status] || ""}`}>
                      {(req.status || "submitted").replace("_", " ")}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{req.category}</Badge>
                    {(req as any).source === "beacon" && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${SOURCE_STYLES.beacon.className}`}>
                        <Bot className="h-2.5 w-2.5" />
                        Beacon
                      </Badge>
                    )}
                  </div>
                  {req.description && <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && req.status !== "approved" && req.status !== "completed" && (
                    <div className="flex items-center gap-1">
                      <Select
                        value={req.status || "submitted"}
                        onValueChange={(status) => updateStatusMutation.mutate({ id: req.id, status })}
                      >
                        <SelectTrigger className="h-7 text-xs w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="under_review">Under Review</SelectItem>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => promoteToRoadmapMutation.mutate(req)}
                        disabled={promoteToRoadmapMutation.isPending}
                      >
                        <Rocket className="h-3 w-3" />
                        Roadmap
                      </Button>
                    </div>
                  )}
                  {req.status === "approved" && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-700 border-emerald-300">
                      <Rocket className="h-2.5 w-2.5" />
                      On Roadmap
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(req.created_at), "MM/dd/yy")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
