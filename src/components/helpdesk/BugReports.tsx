import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, CheckCircle2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const PAGES = [
  "Dashboard", "Projects", "Properties", "Proposals", "Invoices / Billing",
  "Time", "Email", "Calendar", "RFPs", "Reports", "Companies / Clients",
  "Documents", "Settings", "Auth / Login", "Help Center", "Other",
];

export function BugReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState("");
  const [action, setAction] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [priority, setPriority] = useState("medium");

  const { data: reports = [] } = useQuery({
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
    },
    onSuccess: () => {
      toast({ title: "Bug report submitted", description: "Your team will be notified." });
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
      setShowForm(false);
      setPage("");
      setAction("");
      setExpected("");
      setActual("");
      setPriority("medium");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Bug Reports</h2>
          <p className="text-sm text-muted-foreground">Report issues so the team can track and resolve them.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Report Bug
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bug className="h-4 w-4" />
              New Bug Report
            </CardTitle>
            <CardDescription>Describe the issue clearly so it can be reproduced.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Page / Area</Label>
                <Select value={page} onValueChange={setPage}>
                  <SelectTrigger><SelectValue placeholder="Select page..." /></SelectTrigger>
                  <SelectContent>
                    {PAGES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
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
              <Label>What did you do? (Action)</Label>
              <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Clicked 'Add Service' button in the catalog" />
            </div>
            <div className="space-y-2">
              <Label>What should have happened? (Expected)</Label>
              <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="e.g. A new empty row should appear at the top of the table" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>What actually happened? (Actual)</Label>
              <Textarea value={actual} onChange={(e) => setActual(e.target.value)} placeholder="e.g. Nothing happened — no new row, no error message" rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!page || !action || !expected || !actual || submitBug.isPending}
                onClick={() => submitBug.mutate()}
              >
                {submitBug.isPending ? "Submitting..." : "Submit Bug Report"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing reports */}
      <div className="space-y-2">
        {reports.length === 0 && !showForm && (
          <div className="text-center py-8 text-muted-foreground">
            <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No bug reports yet.</p>
            <p className="text-sm">Click "Report Bug" to submit an issue.</p>
          </div>
        )}
        {reports.map((report: any) => (
          <Card key={report.id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {report.status === "resolved" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <Bug className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">{report.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
                    {report.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={report.priority === "critical" || report.priority === "high" ? "destructive" : "secondary"} className="text-xs">
                    {report.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(report.created_at), "MMM d")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
