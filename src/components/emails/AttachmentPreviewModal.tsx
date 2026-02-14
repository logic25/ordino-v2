import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface AttachmentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  filename: string;
  mimeType: string;
}

export function AttachmentPreviewModal({
  open,
  onOpenChange,
  url,
  filename,
  mimeType,
}: AttachmentPreviewModalProps) {
  if (!url) return null;

  const isImage = /^image\//i.test(mimeType);
  const isPdf = /^application\/pdf$/i.test(mimeType);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-medium truncate pr-4">
            {filename}
          </DialogTitle>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
        </DialogHeader>
        <div className="flex-1 overflow-auto px-6 pb-6 min-h-0">
          {isImage && (
            <img
              src={url}
              alt={filename}
              className="max-w-full h-auto mx-auto rounded"
            />
          )}
          {isPdf && (
            <iframe
              src={url}
              title={filename}
              className="w-full h-[70vh] rounded border"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
