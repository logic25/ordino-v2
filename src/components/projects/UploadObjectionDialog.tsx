import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ParsedItem {
  id: string;
  item_number: number;
  objection_text: string;
  code_reference: string | null;
  category: string | null;
  status: string | null;
}

interface UploadObjectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const categoryColors: Record<string, string> = {
  zoning: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  egress: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  structural: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  fire: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  plumbing: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  mechanical: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  electrical: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  administrative: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  other: "bg-muted text-muted-foreground",
};

export function UploadObjectionDialog({ open, onOpenChange, projectId }: UploadObjectionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("File size must be under 20MB.");
        return;
      }
      setSelectedFile(file);
      setError(null);
      setParsedItems([]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("project_id", projectId);

      const { data: { session } } = await supabase.auth.getSession();
      const projectIdEnv = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const res = await fetch(
        `https://${projectIdEnv}.supabase.co/functions/v1/parse-objection`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to parse objection letter.");
        return;
      }

      setParsedItems(data.items || []);
      queryClient.invalidateQueries({ queryKey: ["objection_items", projectId] });
      toast({
        title: "Objection letter parsed",
        description: `${data.items_count} objection item${data.items_count !== 1 ? "s" : ""} extracted and saved.`,
      });
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setSelectedFile(null);
      setParsedItems([]);
      setError(null);
      setExpandedItems(new Set());
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Objection Letter
          </DialogTitle>
          <DialogDescription>
            Upload a DOB objection letter PDF. It will be parsed automatically to extract individual objection items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* File selection */}
          {parsedItems.length === 0 && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  selectedFile
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                )}
              >
                {selectedFile ? (
                  <div className="flex items-center gap-2 justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select a PDF file</p>
                    <p className="text-xs text-muted-foreground mt-1">Max 20MB</p>
                  </>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing objection letter...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Parse
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Results */}
          {parsedItems.length > 0 && (
            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">
                  {parsedItems.length} objection{parsedItems.length !== 1 ? "s" : ""} extracted
                </span>
              </div>

              <ScrollArea className="flex-1 max-h-[400px]">
                <div className="space-y-2 pr-2">
                  {parsedItems.map((item, idx) => {
                    const isExpanded = expandedItems.has(idx);
                    return (
                      <div key={item.id} className="border rounded-lg">
                        <button
                          onClick={() => toggleExpand(idx)}
                          className="w-full flex items-start gap-2 p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">
                                #{item.item_number}
                              </span>
                              {item.code_reference && (
                                <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                                  {item.code_reference}
                                </Badge>
                              )}
                              {item.category && (
                                <Badge className={cn("text-[10px] px-1.5 py-0 border-0", categoryColors[item.category] || categoryColors.other)}>
                                  {item.category}
                                </Badge>
                              )}
                            </div>
                            {!isExpanded && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {item.objection_text}
                              </p>
                            )}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pl-9">
                            <p className="text-sm leading-relaxed">{item.objection_text}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <Button variant="outline" onClick={handleClose} className="mt-3 w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
