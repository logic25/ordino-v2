import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Paperclip, X, FileIcon, Eye } from "lucide-react";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { useUndoableSend } from "@/hooks/useUndoableSend";
import { useSaveDraft, useDeleteDraft, type EmailDraft } from "@/hooks/useEmailDrafts";
import { useCreateScheduledEmail } from "@/hooks/useScheduledEmails";
import { ScheduleSendDropdown } from "./ScheduleSendDropdown";
import { RecipientInput } from "./RecipientInput";
import { RichTextEditor } from "./RichTextEditor";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTelemetry } from "@/hooks/useTelemetry";

interface AttachmentFile {
  file: File;
  name: string;
  size: number;
  base64?: string;
}

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft?: EmailDraft | null;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultAttachments?: AttachmentFile[];
  /** Optional transform applied to body HTML before sending (e.g. wrap in styled email template) */
  transformBodyOnSend?: (html: string) => string;
}

export function ComposeEmailDialog({ open, onOpenChange, draft, defaultTo, defaultSubject, defaultBody, defaultAttachments, transformBodyOnSend }: ComposeEmailDialogProps) {
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; filename: string; mimeType: string } | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { send: undoableSend, isPending: isSending } = useUndoableSend();
  const saveDraft = useSaveDraft();
  const removeDraft = useDeleteDraft();
  const scheduleEmail = useCreateScheduledEmail();
  const { toast } = useToast();
  const { track } = useTelemetry();

  // Load draft data when opening with a draft
  useEffect(() => {
    if (draft && open) {
      setTo(draft.to_recipients || []);
      setCc(draft.cc_recipients || []);
      setBcc(draft.bcc_recipients || []);
      setSubject(draft.subject || "");
      setBody(draft.body_html || "");
      setDraftId(draft.id);
      setShowCcBcc((draft.cc_recipients?.length || 0) > 0 || (draft.bcc_recipients?.length || 0) > 0);
    }
  }, [draft, open]);

  // Load defaults when opening without a draft (e.g., email blast)
  useEffect(() => {
    if (open && !draft) {
      if (defaultTo) setTo(defaultTo.split(",").map((e) => e.trim()).filter(Boolean));
      if (defaultSubject) setSubject(defaultSubject);
      if (defaultBody) setBody(defaultBody);
      if (defaultAttachments && defaultAttachments.length > 0) setAttachments(defaultAttachments);
    }
  }, [open, draft, defaultTo, defaultSubject, defaultBody, defaultAttachments]);

  // Auto-save draft every 5 seconds when content changes
  useEffect(() => {
    if (!open) return;
    if (!to.length && !subject && !body) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const result = await saveDraft.mutateAsync({
          id: draftId || undefined,
          to,
          cc: cc.length > 0 ? cc : undefined,
          bcc: bcc.length > 0 ? bcc : undefined,
          subject,
          bodyHtml: body,
        });
        if (!draftId && result?.id) {
          setDraftId((result as any).id);
        }
      } catch {
        // Silent fail for auto-save
      }
    }, 5000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [to, cc, bcc, subject, body, open]);

  const resetForm = () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject("");
    setBody("");
    setShowCcBcc(false);
    setAttachments([]);
    setIsDragOver(false);
    setDraftId(null);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  };

  const cleanupDraftOnSend = async () => {
    if (draftId) {
      try { await removeDraft.mutateAsync(draftId); } catch {}
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:...;base64, prefix
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const newAttachments: AttachmentFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 25MB limit`, variant: "destructive" });
        continue;
      }
      const base64 = await readFileAsBase64(file);
      newAttachments.push({ file, name: file.name, size: file.size, base64 });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, [toast]);

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const buildAttachmentsPayload = () =>
    attachments
      .filter((a) => a.base64)
      .map((a) => ({
        filename: a.name,
        content: a.base64!,
        mime_type: a.file.type || "application/octet-stream",
      }));

  const handleSend = () => {
    if (to.length === 0 || !subject.trim() || !body.trim()) return;
    const finalBody = transformBodyOnSend ? transformBodyOnSend(body) : body;
    undoableSend(
      {
        to: to.join(", "),
        cc: cc.length > 0 ? cc.join(", ") : undefined,
        bcc: bcc.length > 0 ? bcc.join(", ") : undefined,
        subject: subject.trim(),
        html_body: finalBody,
        attachments: buildAttachmentsPayload(),
      },
      async () => {
        await cleanupDraftOnSend();
        resetForm();
        onOpenChange(false);
      }
    );
  };

  const handleSchedule = async (date: Date) => {
    if (to.length === 0 || !subject.trim() || !body.trim()) return;
    const finalBody = transformBodyOnSend ? transformBodyOnSend(body) : body;
    try {
      await scheduleEmail.mutateAsync({
        emailDraft: {
          to: to.join(", "),
          cc: cc.length > 0 ? cc.join(", ") : undefined,
          bcc: bcc.length > 0 ? bcc.join(", ") : undefined,
          subject: subject.trim(),
          html_body: finalBody,
          attachments: buildAttachmentsPayload(),
        },
        scheduledSendTime: date,
      });
      toast({
        title: "Email Scheduled",
        description: `Will send on ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      });
      await cleanupDraftOnSend();
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Schedule Failed", description: err.message, variant: "destructive" });
    }
  };

  const canSend = to.length > 0 && subject.trim() && body.trim() && !isSending;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Email</DialogTitle>
        </DialogHeader>

        <div
          className={cn("space-y-3", isDragOver && "ring-2 ring-primary ring-offset-2 rounded-lg")}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-1.5">
            <Label htmlFor="compose-to" className="text-xs">To</Label>
            <RecipientInput
              id="compose-to"
              value={to}
              onChange={setTo}
              placeholder="recipient@example.com"
            />
          </div>

          {!showCcBcc ? (
            <button
              onClick={() => setShowCcBcc(true)}
              className="text-xs text-primary hover:underline"
            >
              + Cc/Bcc
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs w-8">Cc</Label>
                <RecipientInput
                  value={cc}
                  onChange={setCc}
                  placeholder="cc@example.com"
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs w-8">Bcc</Label>
                <RecipientInput
                  value={bcc}
                  onChange={setBcc}
                  placeholder="bcc@example.com"
                  className="flex-1"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="compose-subject" className="text-xs">Subject</Label>
            <Input
              id="compose-subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Write your message..."
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Attachments</Label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1.5 py-1 px-2">
                    <FileIcon className="h-3 w-3" />
                    <button
                      type="button"
                      className="truncate max-w-[140px] hover:underline cursor-pointer"
                      onClick={async () => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setPreviewAttachment({ url: reader.result as string, filename: att.name, mimeType: att.file.type });
                        };
                        reader.readAsDataURL(att.file);
                      }}
                    >
                      {att.name}
                    </button>
                    <span className="text-muted-foreground">{formatSize(att.size)}</span>
                    <button onClick={() => removeAttachment(i)} className="hover:opacity-70">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files (or drag & drop)"
              >
                <Paperclip className="h-4 w-4" />
                <span>Attach or drop files</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <ScheduleSendDropdown
                onSchedule={handleSchedule}
                disabled={!canSend || scheduleEmail.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={!canSend}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Send
              </Button>
            </div>
          </div>

          {isDragOver && (
            <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none z-10">
              <p className="text-sm font-medium text-primary">Drop files here</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AttachmentPreviewModal
      open={!!previewAttachment}
      onOpenChange={(open) => { if (!open) setPreviewAttachment(null); }}
      url={previewAttachment?.url || null}
      filename={previewAttachment?.filename || ""}
      mimeType={previewAttachment?.mimeType || ""}
    />
    </>
  );
}
