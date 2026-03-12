import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, CheckCircle2, Plus, Clock, Filter, ArrowUpDown, Loader2, Upload, Video, X, Image as ImageIcon, Copy, History, Send, MessageSquare, Eye, Paperclip, ThumbsUp, ThumbsDown, FileIcon } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const PAGES = [
  "Dashboard", "Projects", "Properties", "Proposals", "Invoices / Billing",
  "Time", "Email", "Calendar", "RFPs", "Reports", "Companies / Clients",
  "Documents", "Settings", "Auth / Login", "Help Center", "Other",
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready_for_review", label: "Ready for Review" },
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
  if (status === "ready_for_review") return <Eye className="h-4 w-4 text-purple-500" />;
  if (status === "in_progress") return <Clock className="h-4 w-4 text-amber-500" />;
  return <Bug className="h-4 w-4 text-destructive" />;
};

const priorityVariant = (p: string) =>
  p === "critical" || p === "high" ? "destructive" as const : "secondary" as const;

function toLoomEmbed(url: string): string | null {
  const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  return match ? `https://www.loom.com/embed/${match[1]}` : null;
}

export function BugReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useCompanyProfiles();
  const { data: userRoles = [] } = useUserRoles();
  const isAdmin = userRoles.some((r: any) => r.role === "admin");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [loomUrl, setLoomUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Detail sheet
  const [selectedBug, setSelectedBug] = useState<any>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Activity log query
  const { data: activityLogs = [] } = useQuery({
    queryKey: ["bug-activity", selectedBug?.id],
    queryFn: async () => {
      if (!selectedBug?.id) return [];
      const { data } = await supabase
        .from("bug_activity_logs")
        .select("*")
        .eq("bug_id", selectedBug.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedBug?.id,
  });

  // Comments query
  const { data: comments = [] } = useQuery({
    queryKey: ["bug-comments", selectedBug?.id],
    queryFn: async () => {
      if (!selectedBug?.id) return [];
      const { data } = await supabase
        .from("bug_comments")
        .select("*")
        .eq("bug_id", selectedBug.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedBug?.id,
  });

  // Post comment mutation
  const postComment = useMutation({
    mutationFn: async ({ message, files }: { message: string; files: File[] }) => {
      if (!selectedBug || !profile) throw new Error("Missing context");

      // Upload comment attachments if any
      let attachmentData: Array<{ url: string; name: string; type: string }> | null = null;
      if (files.length > 0) {
        attachmentData = [];
        for (const file of files) {
          const path = `${profile.company_id}/${selectedBug.id}/comments/${Date.now()}-${file.name}`;
          const { error: uploadErr } = await supabase.storage.from("bug-attachments").upload(path, file);
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("bug-attachments").getPublicUrl(path);
            attachmentData.push({ url: urlData.publicUrl, name: file.name, type: file.type });
          }
        }
      }

      const { error } = await supabase.from("bug_comments").insert({
        bug_id: selectedBug.id,
        company_id: selectedBug.company_id,
        user_id: profile.id,
        message,
        attachments: attachmentData,
      } as any);
      if (error) throw error;

      // Send email notification (best-effort)
      supabase.functions.invoke("send-bug-alert", {
        body: {
          action: "comment",
          bug_id: selectedBug.id,
          bug_title: selectedBug.title,
          bug_description: selectedBug.description,
          company_id: selectedBug.company_id,
          commenter_user_id: profile.id,
          commenter_name: profile.display_name || `${profile.first_name} ${profile.last_name}`,
          comment_message: message,
          reporter_user_id: selectedBug.user_id,
          comment_attachments: attachmentData,
        },
      }).catch(() => {});
    },
    onSuccess: () => {
      setNewComment("");
      setCommentFiles([]);
      queryClient.invalidateQueries({ queryKey: ["bug-comments", selectedBug?.id] });
      // Also log activity
      if (selectedBug && profile) {
        supabase.from("bug_activity_logs").insert({
          bug_id: selectedBug.id,
          company_id: selectedBug.company_id,
          user_id: profile.id,
          action_type: "comment",
          note: newComment.substring(0, 200),
        }).then(() => queryClient.invalidateQueries({ queryKey: ["bug-activity", selectedBug.id] }));
      }
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (err: any) => {
      toast({ title: "Error posting comment", description: err.message, variant: "destructive" });
    },
  });

  const getActivityDescription = (log: any) => {
    const userName = profiles.find((p) => p.id === log.user_id)?.display_name || "Someone";
    switch (log.action_type) {
      case "status_change":
        return `${userName} changed status from "${log.old_value}" to "${log.new_value}"`;
      case "assignment_change":
        return `${userName} reassigned from ${log.old_value} to ${log.new_value}`;
      case "notes_updated":
        return `${userName} updated resolution notes`;
      case "comment":
        return `${userName} posted a comment`;
      case "email_reply":
        return `${userName} replied via email`;
      default:
        return `${userName} made a change`;
    }
  };

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
  const readyForReviewCount = reports.filter((r: any) => r.status === "ready_for_review").length;
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

  const uploadFiles = async (bugId: string, files: File[]): Promise<Array<{url: string; name: string; type: string}>> => {
    const results: Array<{url: string; name: string; type: string}> = [];
    for (const file of files) {
      const path = `${profile!.company_id}/${bugId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("bug-attachments").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("bug-attachments").getPublicUrl(path);
        results.push({ url: urlData.publicUrl, name: file.name, type: file.type });
      }
    }
    return results;
  };

  const submitBug = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id || !profile?.id) throw new Error("No company");
      let description = `**Page:** ${page}\n**Action:** ${action}\n**Expected:** ${expected}\n**Actual:** ${actual}`;
      if (transcript.trim()) {
        description += `\n\n**Transcript / Context:**\n${transcript.trim()}`;
      }
      
      // Insert bug first to get ID
      const { data: inserted, error } = await supabase.from("feature_requests").insert({
        company_id: profile.company_id,
        user_id: profile.id,
        title: `[${page}] ${action.slice(0, 80)}`,
        description,
        category: "bug_report",
        priority,
        status: "open",
        loom_url: loomUrl || null,
      }).select("id").single();
      if (error) throw error;

      // Upload files if any
      if (pendingFiles.length > 0 && inserted) {
        const attachments = await uploadFiles(inserted.id, pendingFiles);
        await supabase.from("feature_requests").update({ attachments }).eq("id", inserted.id);
      }

      // Fire email alert (best-effort)
      if (inserted) {
        supabase.functions.invoke("send-bug-alert", {
          body: {
            bug_id: inserted.id,
            bug_title: `[${page}] ${action.slice(0, 80)}`,
            bug_description: description,
            bug_priority: priority,
            company_id: profile.company_id,
            reporter_name: profile.display_name || `${profile.first_name} ${profile.last_name}`,
          },
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast({ title: "Bug report submitted", description: "Team members have been notified." });
      queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
      setShowForm(false);
      setPage(""); setAction(""); setExpected(""); setActual(""); setPriority("medium"); setTranscript("");
      setLoomUrl(""); setPendingFiles([]);
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
    setNewComment("");
    setCommentFiles([]);
  };

  const saveDetail = async () => {
    if (!selectedBug || !profile) return;
    const updates: Record<string, any> = {
      status: editStatus,
      admin_notes: editNotes || null,
      assigned_to: editAssignee === "__unassigned__" ? null : (editAssignee || null),
    };
    if (editStatus === "resolved" && selectedBug.status !== "resolved") {
      updates.resolved_at = new Date().toISOString();
    }
    if (editStatus !== "resolved") {
      updates.resolved_at = null;
    }

    // Build activity log entries
    const activities: Array<{ bug_id: string; company_id: string; user_id: string; action_type: string; field_changed?: string; old_value?: string; new_value?: string; note?: string }> = [];
    const bugId = selectedBug.id;
    const companyId = selectedBug.company_id;

    if (editStatus !== selectedBug.status) {
      activities.push({ bug_id: bugId, company_id: companyId, user_id: profile.id, action_type: "status_change", field_changed: "status", old_value: selectedBug.status, new_value: editStatus });
    }
    const newAssignee = editAssignee === "__unassigned__" ? null : (editAssignee || null);
    if (newAssignee !== (selectedBug.assigned_to || null)) {
      const oldName = getAssigneeName(selectedBug.assigned_to) || "Unassigned";
      const newName = getAssigneeName(newAssignee) || "Unassigned";
      activities.push({ bug_id: bugId, company_id: companyId, user_id: profile.id, action_type: "assignment_change", field_changed: "assigned_to", old_value: oldName, new_value: newName });
    }
    if ((editNotes || "") !== (selectedBug.admin_notes || "")) {
      activities.push({ bug_id: bugId, company_id: companyId, user_id: profile.id, action_type: "notes_updated", note: editNotes || undefined });
    }

    // Insert activity logs (best-effort)
    if (activities.length > 0) {
      supabase.from("bug_activity_logs").insert(activities).then(() => {
        queryClient.invalidateQueries({ queryKey: ["bug-activity", bugId] });
      });
    }

    const isNewlyResolved = editStatus === "resolved" && selectedBug.status !== "resolved";
    const isReopened = editStatus === "open" && selectedBug.status === "resolved";
    const isMovedToInProgress = editStatus === "in_progress" && selectedBug.status === "open";
    const isReadyForReview = editStatus === "ready_for_review" && selectedBug.status !== "ready_for_review";
    updateBug.mutate({ id: selectedBug.id, updates }, {
      onSuccess: async () => {
        // Fetch recent comments to include in status-change emails
        let recentComments: Array<{ message: string; commenter_name: string; created_at: string; attachments?: any }> = [];
        if (isNewlyResolved || isReadyForReview || isMovedToInProgress || isReopened) {
          const { data: cmts } = await supabase
            .from("bug_comments")
            .select("message, created_at, user_id, attachments")
            .eq("bug_id", selectedBug.id)
            .order("created_at", { ascending: false })
            .limit(5);
          if (cmts) {
            recentComments = cmts.map((c: any) => ({
              message: c.message,
              created_at: c.created_at,
              commenter_name: profiles.find((p) => p.id === c.user_id)?.display_name || "Someone",
              attachments: c.attachments,
            })).reverse();
          }
        }

        if (isNewlyResolved) {
          supabase.functions.invoke("send-bug-alert", {
            body: {
              action: "resolved",
              bug_id: selectedBug.id,
              bug_title: selectedBug.title,
              company_id: selectedBug.company_id,
              reporter_user_id: selectedBug.user_id,
              admin_notes: editNotes || undefined,
              recent_comments: recentComments,
            },
          }).catch(() => {});
        }
        if (isReopened) {
          supabase.functions.invoke("send-bug-alert", {
            body: {
              action: "reopened",
              bug_id: selectedBug.id,
              bug_title: selectedBug.title,
              bug_description: selectedBug.description,
              company_id: selectedBug.company_id,
              reporter_user_id: selectedBug.user_id,
              recent_comments: recentComments,
            },
          }).catch(() => {});
        }
        if (isMovedToInProgress) {
          supabase.functions.invoke("send-bug-alert", {
            body: {
              action: "in_progress",
              bug_id: selectedBug.id,
              bug_title: selectedBug.title,
              bug_description: selectedBug.description,
              company_id: selectedBug.company_id,
              reporter_user_id: selectedBug.user_id,
              recent_comments: recentComments,
            },
          }).catch(() => {});
        }
        if (isReadyForReview) {
          supabase.functions.invoke("send-bug-alert", {
            body: {
              action: "ready_for_review",
              bug_id: selectedBug.id,
              bug_title: selectedBug.title,
              bug_description: selectedBug.description,
              admin_notes: editNotes || selectedBug.admin_notes || "",
              company_id: selectedBug.company_id,
              reporter_user_id: selectedBug.user_id,
              recent_comments: recentComments,
            },
          }).catch(() => {});
        }
        setSelectedBug(null);
      },
    });
  };

  const copyForLovable = () => {
    if (!selectedBug) return;
    const attachments = getAttachments(selectedBug);
    const parts = [
      `**Bug Report: ${selectedBug.title}**`,
      `Priority: ${selectedBug.priority}`,
      "",
      selectedBug.description,
    ];
    if (selectedBug.loom_url) parts.push("", `Loom: ${selectedBug.loom_url}`);
    if (attachments.length > 0) parts.push("", `Screenshots:\n${attachments.map(a => `- ${a.url}`).join("\n")}`);
    if (editNotes) parts.push("", `Admin Notes: ${editNotes}`);
    parts.push("", "Please analyze this bug and suggest a fix.");

    navigator.clipboard.writeText(parts.join("\n"));
    toast({ title: "Copied to clipboard", description: "Paste into Lovable chat to get a fix." });
  };

  const getAssigneeName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((pr) => pr.id === id);
    return p ? p.display_name || `${p.first_name} ${p.last_name}` : "—";
  };

  const getAttachments = (bug: any): Array<{url: string; name: string; type: string}> => {
    if (!bug.attachments) return [];
    try {
      return Array.isArray(bug.attachments) ? bug.attachments : JSON.parse(bug.attachments);
    } catch { return []; }
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
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Open", count: openCount, color: "text-destructive", filter: "open" },
          { label: "In Progress", count: inProgressCount, color: "text-amber-500", filter: "in_progress" },
          { label: "Ready for Review", count: readyForReviewCount, color: "text-purple-500", filter: "ready_for_review" },
          { label: "Resolved", count: resolvedCount, color: "text-green-500", filter: "resolved" },
          { label: "Critical", count: criticalCount, color: "text-destructive", filter: "critical" },
        ].map((s) => (
          <Card
            key={s.label}
            className="cursor-pointer hover:ring-2 ring-primary/30 transition-all"
            onClick={() => {
              if (s.filter === "critical") {
                setPriorityFilter("critical");
                setStatusFilter("all");
              } else {
                setStatusFilter(s.filter);
                setPriorityFilter("all");
              }
            }}
          >
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

            {/* Screenshots upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Screenshots</Label>
              <div
                className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
                  setPendingFiles((prev) => [...prev, ...files]);
                }}
              >
                <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Click or drag screenshots here</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />
              </div>
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="relative group">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 object-cover rounded border" />
                      <button
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Loom URL */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Video className="h-3.5 w-3.5" /> Loom / Video Link (optional)</Label>
              <Input value={loomUrl} onChange={(e) => setLoomUrl(e.target.value)} placeholder="https://www.loom.com/share/..." />
            </div>

            {/* Transcript / Additional Context */}
            <div className="space-y-2">
              <Label>Transcript / Additional Context (optional)</Label>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste Loom transcript or any additional context here..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setPendingFiles([]); setLoomUrl(""); setTranscript(""); }}>Cancel</Button>
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
                <TableHead className="w-16">Media</TableHead>
                <TableHead className="w-24">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((bug: any) => {
                const attachments = getAttachments(bug);
                const hasMedia = attachments.length > 0 || !!bug.loom_url;
                return (
                  <TableRow key={bug.id} className="cursor-pointer" onClick={() => openDetail(bug)}>
                    <TableCell>{statusIcon(bug.status)}</TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">{bug.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(bug.priority)} className="text-xs">{bug.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getAssigneeName(bug.assigned_to)}</TableCell>
                    <TableCell>
                      {hasMedia && (
                        <div className="flex gap-1">
                          {attachments.length > 0 && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                          {bug.loom_url && <Video className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(bug.created_at), "MMM d")}</TableCell>
                  </TableRow>
                );
              })}
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
                  <div className="mt-1 space-y-3 text-sm bg-muted/50 rounded-md p-4">
                    {(() => {
                      // Normalize: replace literal \n with real newlines
                      const raw = (selectedBug.description || "").replace(/\\n/g, "\n");
                      // Parse structured fields like **Label:** Value
                      const fieldRegex = /\*\*(.+?):\*\*\s*([\s\S]*?)(?=\n\*\*|\n\n|$)/g;
                      const fields: { label: string; value: string }[] = [];
                      let match;
                      while ((match = fieldRegex.exec(raw)) !== null) {
                        fields.push({ label: match[1].trim(), value: match[2].trim() });
                      }
                      if (fields.length > 0) {
                        return fields.map((f, i) => (
                          <div key={i} className="space-y-0.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</p>
                            <p className="text-foreground whitespace-pre-line leading-relaxed">{f.value}</p>
                          </div>
                        ));
                      }
                      // Fallback: plain text
                      return <p className="text-foreground whitespace-pre-line leading-relaxed">{raw}</p>;
                    })()}
                  </div>
                </div>

                {/* Attachments */}
                {getAttachments(selectedBug).length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Screenshots</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {getAttachments(selectedBug).map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                          <img src={att.url} alt={att.name} className="h-24 w-auto rounded border hover:ring-2 ring-primary transition-all" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loom embed */}
                {selectedBug.loom_url && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Video</Label>
                    {toLoomEmbed(selectedBug.loom_url) ? (
                      <div className="mt-1 rounded-md overflow-hidden border aspect-video">
                        <iframe
                          src={toLoomEmbed(selectedBug.loom_url)!}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <a href={selectedBug.loom_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline mt-1 block">
                        {selectedBug.loom_url}
                      </a>
                    )}
                  </div>
                )}

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

                {/* Reporter */}
                <div>
                  <Label className="text-xs text-muted-foreground">Reported By</Label>
                  <p className="mt-1 text-sm font-medium">{getAssigneeName(selectedBug.user_id)}</p>
                </div>

                {/* Comments Thread */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">Comments</h4>
                    {comments.length > 0 && <Badge variant="secondary" className="text-xs">{comments.length}</Badge>}
                  </div>
                  {comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No comments yet. Start a conversation about this bug.</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
                      {comments.map((c: any) => {
                        const commenterName = profiles.find((p) => p.id === c.user_id)?.display_name || "Unknown";
                        const isCurrentUser = c.user_id === profile?.id;
                        const commentAttachments: Array<{ url: string; name: string; type: string }> = (() => {
                          if (!c.attachments) return [];
                          try { return Array.isArray(c.attachments) ? c.attachments : JSON.parse(c.attachments); } catch { return []; }
                        })();
                        return (
                          <div key={c.id} className={cn("rounded-lg p-3 text-sm", isCurrentUser ? "bg-primary/10 ml-4" : "bg-muted/50 mr-4")}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-xs">{commenterName}</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                            </div>
                            <p className="text-foreground whitespace-pre-line">{c.message}</p>
                            {commentAttachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {commentAttachments.map((att, i) =>
                                  att.type?.startsWith("image/") ? (
                                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                                      <img src={att.url} alt={att.name} className="h-20 w-auto rounded border hover:ring-2 ring-primary transition-all" />
                                    </a>
                                  ) : (
                                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary underline">
                                      <FileIcon className="h-3 w-3" />{att.name}
                                    </a>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={commentsEndRef} />
                    </div>
                  )}
                  {/* Comment file previews */}
                  {commentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {commentFiles.map((f, i) => (
                        <div key={i} className="relative group">
                          {f.type.startsWith("image/") ? (
                            <img src={URL.createObjectURL(f)} alt={f.name} className="h-14 w-14 object-cover rounded border" />
                          ) : (
                            <div className="h-14 w-14 rounded border flex items-center justify-center bg-muted">
                              <FileIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <button
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setCommentFiles((prev) => prev.filter((_, j) => j !== i))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      rows={3}
                      className="resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && (newComment.trim() || commentFiles.length > 0)) {
                          e.preventDefault();
                          postComment.mutate({ message: newComment.trim(), files: commentFiles });
                        }
                      }}
                    />
                    <div className="flex gap-2 justify-end">
                      <input
                        ref={commentFileRef}
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) setCommentFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                          e.target.value = "";
                        }}
                      />
                      <Button size="sm" variant="outline" onClick={() => commentFileRef.current?.click()} title="Attach file">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        disabled={(!newComment.trim() && commentFiles.length === 0) || postComment.isPending}
                        onClick={() => postComment.mutate({ message: newComment.trim(), files: commentFiles })}
                      >
                        <Send className="h-4 w-4 mr-1" /> Post
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Copy for Lovable — visible to everyone */}
                <div className="border-t pt-4">
                  <Button size="sm" variant="outline" className="w-full" onClick={copyForLovable}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Copy for Lovable
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1 text-center">Copy formatted bug report to paste into Lovable chat</p>
                </div>

                {isAdmin && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-semibold text-sm">Management</h4>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="ready_for_review">Ready for Review</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assign To</Label>
                      <Select value={editAssignee} onValueChange={setEditAssignee}>
                        <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unassigned__">Unassigned</SelectItem>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.display_name || `${p.first_name} ${p.last_name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Resolution Notes</Label>
                      <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Resolution summary or internal notes..." rows={3} />
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
                )}

                {/* Reviewer actions for non-admin reporter when status is ready_for_review */}
                {!isAdmin && selectedBug.user_id === profile?.id && selectedBug.status === "ready_for_review" && (
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="font-semibold text-sm">Review This Fix</h4>
                    <p className="text-xs text-muted-foreground">This bug has been marked as ready for your review. Please test and confirm.</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          updateBug.mutate({ id: selectedBug.id, updates: { status: "resolved", resolved_at: new Date().toISOString() } }, {
                            onSuccess: () => {
                              supabase.from("bug_activity_logs").insert({
                                bug_id: selectedBug.id, company_id: selectedBug.company_id, user_id: profile!.id,
                                action_type: "status_change", field_changed: "status", old_value: "ready_for_review", new_value: "resolved",
                              }).then(() => queryClient.invalidateQueries({ queryKey: ["bug-activity", selectedBug.id] }));
                              supabase.functions.invoke("send-bug-alert", {
                                body: { action: "resolved", bug_id: selectedBug.id, bug_title: selectedBug.title, company_id: selectedBug.company_id, reporter_user_id: selectedBug.user_id },
                              }).catch(() => {});
                              setSelectedBug(null);
                            },
                          });
                        }}
                        disabled={updateBug.isPending}
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Confirm Fixed
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => {
                          const reason = prompt("What's still broken? (This will be posted as a comment)");
                          if (!reason) return;
                          // Post comment first, then change status
                          postComment.mutate({ message: `🔴 Still broken: ${reason}`, files: [] }, {
                            onSuccess: () => {
                              updateBug.mutate({ id: selectedBug.id, updates: { status: "in_progress", resolved_at: null } }, {
                                onSuccess: () => {
                                  supabase.from("bug_activity_logs").insert({
                                    bug_id: selectedBug.id, company_id: selectedBug.company_id, user_id: profile!.id,
                                    action_type: "status_change", field_changed: "status", old_value: "ready_for_review", new_value: "in_progress",
                                  }).then(() => queryClient.invalidateQueries({ queryKey: ["bug-activity", selectedBug.id] }));
                                  supabase.functions.invoke("send-bug-alert", {
                                    body: { action: "reopened", bug_id: selectedBug.id, bug_title: selectedBug.title, bug_description: selectedBug.description, company_id: selectedBug.company_id, reporter_user_id: selectedBug.user_id },
                                  }).catch(() => {});
                                  setSelectedBug(null);
                                },
                              });
                            },
                          });
                        }}
                        disabled={updateBug.isPending || postComment.isPending}
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Still Broken
                      </Button>
                    </div>
                  </div>
                )}


                {/* Activity Timeline */}
                {activityLogs.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold text-sm">Activity Log</h4>
                      <Badge variant="secondary" className="text-xs">{activityLogs.length}</Badge>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {activityLogs.map((log: any) => (
                        <div key={log.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "h-2 w-2 rounded-full mt-1.5 shrink-0",
                              log.action_type === "status_change" ? "bg-primary" :
                              log.action_type === "assignment_change" ? "bg-blue-500" :
                              "bg-muted-foreground"
                            )} />
                            <div className="w-px flex-1 bg-border mt-1" />
                          </div>
                          <div className="pb-3 min-w-0">
                            <p className="text-foreground leading-snug">{getActivityDescription(log)}</p>
                            {log.note && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">"{log.note.substring(0, 120)}"</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
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
