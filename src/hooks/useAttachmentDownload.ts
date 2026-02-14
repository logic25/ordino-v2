import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PreviewState {
  url: string;
  filename: string;
  mimeType: string;
}

export function useAttachmentDownload() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const { toast } = useToast();

  const downloadAttachment = async (attachment: {
    id: string;
    filename: string;
    mime_type: string | null;
    gmail_attachment_id: string | null;
    email_id?: string;
  }, gmailMessageId: string) => {
    if (!attachment.gmail_attachment_id) {
      toast({ title: "No attachment data", variant: "destructive" });
      return;
    }

    setDownloadingId(attachment.id);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-attachments", {
        body: {
          attachment_id: attachment.id,
          gmail_message_id: gmailMessageId,
          gmail_attachment_id: attachment.gmail_attachment_id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Convert URL-safe base64 to standard base64
      const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const mimeType = attachment.mime_type || "application/octet-stream";
      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const previewable = /^(image\/(png|jpeg|gif|webp|svg)|application\/pdf)$/i.test(mimeType);

      if (previewable) {
        setPreview({ url, filename: attachment.filename, mimeType });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = attachment.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const closePreview = () => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
  };

  return { downloadAttachment, downloadingId, preview, closePreview };
}
