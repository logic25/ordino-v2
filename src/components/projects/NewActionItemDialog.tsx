import { useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Paperclip, Upload, X } from "lucide-react";
import { useCreateActionItem } from "@/hooks/useActionItems";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useUniversalDocuments } from "@/hooks/useUniversalDocuments";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewActionItemDialog({ projectId, open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [priority, setPriority] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuth();
  const { data: profiles = [] } = useCompanyProfiles();
  const { data: allDocuments = [] } = useUniversalDocuments();
  const documents = useMemo(() => allDocuments.filter(d => d.project_id === projectId), [allDocuments, projectId]);
  const createMutation = useCreateActionItem();
  const { toast } = useToast();

  // Fetch services for this project
  const { data: services = [] } = useQuery({
    queryKey: ["project-services", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    try {
      // Upload files first if any
      let uploadedDocIds: string[] = [];
      if (uploadedFiles.length > 0 && profile?.company_id) {
        setUploading(true);
        for (const file of uploadedFiles) {
          const filePath = `${profile.company_id}/${projectId}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("action-item-attachments")
            .upload(filePath, file);
          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }
          // Store the path as an ID reference
          uploadedDocIds.push(filePath);
        }
        setUploading(false);
      }

      const allAttachmentIds = [...selectedDocIds, ...uploadedDocIds];

      await createMutation.mutateAsync({
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        assigned_to: assignedTo || undefined,
        priority: priority ? "urgent" : "normal",
        due_date: dueDate || undefined,
        attachment_ids: allAttachmentIds.length > 0 ? allAttachmentIds : undefined,
        service_id: (serviceId && serviceId !== "__none") ? serviceId : undefined,
      });
      toast({ title: "Task created" });
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setServiceId("");
      setPriority(false);
      setDueDate("");
      setSelectedDocIds([]);
      setUploadedFiles([]);
      setShowDocPicker(false);
    } catch (err: any) {
      console.error("Task creation error:", err);
      toast({ title: "Error creating task", description: err?.message || "Unknown error", variant: "destructive" });
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="ai-title">Title *</Label>
            <Input id="ai-title" placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Related To (Service) */}
          {services.length > 0 && (
            <div className="space-y-1.5">
              <Label>Related to</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue placeholder="Select a service (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ai-desc">Description</Label>
            <Textarea id="ai-desc" placeholder="Additional details or instructions..." value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-urgent" className="cursor-pointer">Urgent</Label>
            <Switch id="ai-urgent" checked={priority} onCheckedChange={setPriority} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-due">Due date</Label>
            <Input id="ai-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          {/* Attachments section */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowDocPicker(!showDocPicker)}
              >
                <Paperclip className="h-3.5 w-3.5" />
                Project Docs {selectedDocIds.length > 0 && `(${selectedDocIds.length})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Doc picker */}
            {showDocPicker && documents.length > 0 && (
              <ScrollArea className="h-36 rounded-md border p-2">
                {documents.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 py-1 px-1 hover:bg-muted/50 rounded cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedDocIds.includes(doc.id)}
                      onCheckedChange={(checked) => {
                        setSelectedDocIds(prev =>
                          checked ? [...prev, doc.id] : prev.filter(id => id !== doc.id)
                        );
                      }}
                    />
                    <span className="truncate">{doc.title || doc.filename}</span>
                  </label>
                ))}
              </ScrollArea>
            )}
            {showDocPicker && documents.length === 0 && (
              <p className="text-xs text-muted-foreground">No project documents found.</p>
            )}

            {/* Uploaded files preview */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-1">
                {uploadedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(file.size / 1024).toFixed(0)}KB
                    </span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || createMutation.isPending || uploading}>
            {uploading ? "Uploading..." : createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
