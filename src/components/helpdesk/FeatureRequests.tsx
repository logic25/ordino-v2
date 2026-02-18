import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ThumbsUp, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function useFeatureRequests() {
  return useQuery({
    queryKey: ["feature-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("*")
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
  completed: "bg-green-500/10 text-green-700 border-green-300",
};

export function FeatureRequests() {
  const { data: requests, isLoading } = useFeatureRequests();
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");

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
      });
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
      ) : !requests || requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <p>No feature requests yet. Be the first to submit one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((req: any) => (
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-sm">{req.title}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[req.status] || ""}`}>
                      {(req.status || "submitted").replace("_", " ")}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{req.category}</Badge>
                  </div>
                  {req.description && <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(req.created_at), "MM/dd/yy")}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
