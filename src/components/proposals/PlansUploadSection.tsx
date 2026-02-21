import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface UploadedPlan {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number;
}

interface PlansUploadSectionProps {
  proposalId?: string;
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  onFilesChange?: (files: UploadedPlan[]) => void;
}

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export function PlansUploadSection({ proposalId, jobDescription, onJobDescriptionChange, onFilesChange }: PlansUploadSectionProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedPlan[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load existing plans linked to this proposal
  useEffect(() => {
    if (!proposalId || !profile?.company_id || loaded) return;
    (async () => {
      const { data } = await (supabase
        .from("universal_documents")
        .select("id, filename, storage_path, size_bytes") as any)
        .eq("company_id", profile.company_id)
        .eq("proposal_id", proposalId)
        .eq("category", "Plans");
      if (data && data.length > 0) {
        const plans = data.map((d: any) => ({
          id: d.id,
          filename: d.filename,
          storage_path: d.storage_path,
          size_bytes: d.size_bytes || 0,
        }));
        setFiles(plans);
        onFilesChange?.(plans);
      }
      setLoaded(true);
    })();
  }, [proposalId, profile?.company_id, loaded]);

  // Notify parent when files change
  const updateFiles = (newFiles: UploadedPlan[]) => {
    setFiles(newFiles);
    onFilesChange?.(newFiles);
  };

  const uploadFile = async (file: File) => {
    if (!profile?.company_id) throw new Error("No company");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only PDF, PNG, and JPG files are accepted.", variant: "destructive" });
      return null;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Maximum file size is 20MB.", variant: "destructive" });
      return null;
    }

    const ext = file.name.split(".").pop();
    const path = `${profile.company_id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("universal-documents")
      .upload(path, file);
    if (uploadError) throw uploadError;

    // Create document record
    const { data: doc, error: docError } = await supabase.from("universal_documents").insert({
      company_id: profile.company_id,
      title: file.name,
      category: "Plans",
      filename: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: profile.id,
      tags: ["plans"],
      ...(proposalId ? { proposal_id: proposalId } : {}),
    } as any).select("id").single();
    if (docError) throw docError;

    return { id: doc.id, filename: file.name, storage_path: path, size_bytes: file.size };
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    setUploading(true);
    try {
      const results: UploadedPlan[] = [];
      for (const file of Array.from(fileList)) {
        const result = await uploadFile(file);
        if (result) results.push(result);
      }
      const newFiles = [...files, ...results];
      updateFiles(newFiles);
      if (results.length > 0) {
        toast({ title: `${results.length} plan(s) uploaded` });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [files]);

  const handleRemove = async (plan: UploadedPlan) => {
    try {
      await supabase.storage.from("universal-documents").remove([plan.storage_path]);
      await supabase.from("universal_documents").delete().eq("id", plan.id);
      const newFiles = files.filter(f => f.id !== plan.id);
      updateFiles(newFiles);
    } catch (err: any) {
      toast({ title: "Remove failed", description: err.message, variant: "destructive" });
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      toast({ title: "No plans uploaded", description: "Upload plan files first before analyzing.", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    try {
      const fileUrls: string[] = [];
      for (const file of files) {
        const { data } = await supabase.storage
          .from("universal-documents")
          .createSignedUrl(file.storage_path, 3600);
        if (data?.signedUrl) fileUrls.push(data.signedUrl);
      }

      const { data, error } = await supabase.functions.invoke("analyze-plans", {
        body: { file_urls: fileUrls },
      });

      if (error) throw error;
      if (data?.job_description) {
        onJobDescriptionChange(data.job_description);
        toast({ title: "Analysis complete", description: "Job description extracted from plans." });
      } else {
        toast({ title: "No description extracted", description: "The AI could not extract a job description from these plans.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          dragOver ? "border-accent bg-accent/5" : "border-muted-foreground/25 hover:border-muted-foreground/40"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.accept = ACCEPTED_TYPES.join(",");
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files?.length) handleFiles(target.files);
          };
          input.click();
        }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Uploading…</span>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Drag & drop plan files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">PDF, PNG, JPG · Max 20MB each</p>
          </>
        )}
      </div>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map(file => (
            <div key={file.id} className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{file.filename}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.size_bytes)}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemove(file)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 mt-2"
            disabled={analyzing}
            onClick={handleAnalyze}
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {analyzing ? "Analyzing…" : "Analyze Plans"}
          </Button>
        </div>
      )}

      {/* Job description */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Job Description</Label>
        <Textarea
          placeholder="AI-extracted or manually entered job description for the PIS…"
          rows={3}
          className="text-sm"
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">This will pre-fill the Project Information Sheet when the proposal converts to a project.</p>
      </div>
    </div>
  );
}
