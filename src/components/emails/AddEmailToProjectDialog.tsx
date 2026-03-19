import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, Search, Mail } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTagEmail } from "@/hooks/useEmails";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AddEmailToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function AddEmailToProjectDialog({ open, onOpenChange, projectId }: AddEmailToProjectDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [category, setCategory] = useState("other");
  const { toast } = useToast();
  const tagEmail = useTagEmail();

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["emails-for-tagging", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .select("id, subject, from_email, from_name, date, snippet, has_attachments, email_project_tags(project_id)")
        .is("archived_at", null)
        .order("date", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const availableEmails = useMemo(() => {
    const untagged = emails.filter(
      (e: any) => !e.email_project_tags?.some((t: any) => t.project_id === projectId)
    );

    if (!search.trim()) return untagged.slice(0, 50);

    const term = search.toLowerCase();
    return untagged.filter(
      (e: any) =>
        e.subject?.toLowerCase().includes(term) ||
        e.from_name?.toLowerCase().includes(term) ||
        e.from_email?.toLowerCase().includes(term) ||
        e.snippet?.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [emails, search, projectId]);

  const handleSave = async () => {
    if (!selectedEmailId) return;

    try {
      await tagEmail.mutateAsync({ emailId: selectedEmailId, projectId, category });
      toast({ title: "Email added to project" });
      onOpenChange(false);
      setSelectedEmailId(null);
      setCategory("other");
      setSearch("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,32rem)] max-w-[32rem] overflow-hidden p-0">
        <DialogHeader className="min-w-0 px-6 pt-6">
          <DialogTitle>Add Email to Project</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-4 px-6 pb-6">
          <div className="relative min-w-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails by subject, sender..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9"
            />
          </div>

          <div className="w-full min-w-0 max-h-64 overflow-y-auto overflow-x-hidden rounded-md border divide-y">
            {isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading emails...</p>
            ) : availableEmails.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <Mail className="mb-1 h-6 w-6 opacity-40" />
                <p className="text-sm">No matching emails found</p>
              </div>
            ) : (
              availableEmails.map((e: any) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedEmailId(e.id)}
                  className={cn(
                    "flex w-full min-w-0 flex-col gap-1 overflow-hidden px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                    selectedEmailId === e.id && "border-l-2 border-l-primary bg-primary/10"
                  )}
                >
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <span className="block min-w-0 truncate text-sm font-medium">
                      {e.from_name || e.from_email}
                    </span>
                    <div className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                      {e.has_attachments && <Paperclip className="h-3 w-3 shrink-0" />}
                      <span>{e.date ? format(new Date(e.date), "MMM d") : ""}</span>
                    </div>
                  </div>

                  <p className="block w-full truncate text-xs text-muted-foreground">
                    {e.subject || "(no subject)"}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="objection">🚨 Objection</SelectItem>
                <SelectItem value="agency">📋 Agency</SelectItem>
                <SelectItem value="client">👤 Client</SelectItem>
                <SelectItem value="submission">📄 Submission</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedEmailId || tagEmail.isPending}>
            {tagEmail.isPending ? "Adding..." : "Add to Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
