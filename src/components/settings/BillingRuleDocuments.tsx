import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useBillingRuleDocuments,
  useUploadBillingRuleDocument,
  useDeleteBillingRuleDocument,
  useUpdateBillingRuleDocument,
  useDownloadBillingRuleDocument,
  type BillingRuleDocument,
} from "@/hooks/useBillingRuleDocuments";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Upload, FileText, Trash2, RefreshCw, Download, Loader2 } from "lucide-react";

export function BillingRuleDocumentsSection({ billingRuleId }: { billingRuleId: string }) {
  const { data: docs = [], isLoading } = useBillingRuleDocuments(billingRuleId);
  const uploadDoc = useUploadBillingRuleDocument();
  const deleteDoc = useDeleteBillingRuleDocument();
  const updateDoc = useUpdateBillingRuleDocument();
  const downloadDoc = useDownloadBillingRuleDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviseInputRef = useRef<HTMLInputElement>(null);
  const [revisingDoc, setRevisingDoc] = useState<BillingRuleDocument | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadDoc.mutateAsync({ billing_rule_id: billingRuleId, file });
      toast({ title: "Document uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRevise = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !revisingDoc) return;
    try {
      await updateDoc.mutateAsync({ doc: revisingDoc, newFile: file });
      toast({ title: "Document revised" });
    } catch (err: any) {
      toast({ title: "Revision failed", description: err.message, variant: "destructive" });
    }
    setRevisingDoc(null);
    if (reviseInputRef.current) reviseInputRef.current.value = "";
  };

  const handleDelete = async (doc: BillingRuleDocument) => {
    try {
      await deleteDoc.mutateAsync(doc);
      toast({ title: "Document removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDownload = async (doc: BillingRuleDocument) => {
    try {
      await downloadDoc(doc);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Documents
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadDoc.isPending}
        >
          {uploadDoc.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
        />
        <input
          ref={reviseInputRef}
          type="file"
          className="hidden"
          onChange={handleRevise}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">No documents uploaded</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 rounded-md border bg-background text-xs"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{doc.filename}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Uploaded {format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                  {doc.revised_at && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      Revised {format(new Date(doc.revised_at), "MMM d, yyyy")}
                    </Badge>
                  )}
                  {doc.size_bytes && <span>{formatSize(doc.size_bytes)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="Download"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  title="Upload revised version"
                  onClick={() => {
                    setRevisingDoc(doc);
                    reviseInputRef.current?.click();
                  }}
                  disabled={updateDoc.isPending}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive"
                  title="Delete"
                  onClick={() => handleDelete(doc)}
                  disabled={deleteDoc.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
