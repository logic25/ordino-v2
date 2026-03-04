import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Pencil, Save } from "lucide-react";
import { fetchBeaconFileContent } from "@/services/beaconApi";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface Props {
  open: boolean;
  onClose: () => void;
  sourceFile: string;
}

function parseFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  if (!content || !content.trimStart().startsWith('---')) return { metadata: {}, body: content };

  // Remove any leading whitespace/BOM
  const trimmed = content.trimStart();
  
  // Find the closing --- (search after the opening ---)
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline === -1) return { metadata: {}, body: content };
  
  const afterOpening = trimmed.substring(firstNewline + 1);
  const closingIdx = afterOpening.indexOf('\n---');
  if (closingIdx === -1) return { metadata: {}, body: content };

  const frontmatterBlock = afterOpening.substring(0, closingIdx).trim();
  // Skip past closing --- and any following newlines
  let bodyStart = closingIdx + 4; // length of '\n---'
  while (bodyStart < afterOpening.length && (afterOpening[bodyStart] === '\n' || afterOpening[bodyStart] === '\r')) {
    bodyStart++;
  }
  const body = afterOpening.substring(bodyStart);

  const metadata: Record<string, string> = {};
  for (const line of frontmatterBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      if (value && value !== 'null') {
        metadata[key] = value;
      }
    }
  }

  return { metadata, body };
}

const BEACON_API_URL = import.meta.env.VITE_BEACON_API_URL || 'https://beaconrag.up.railway.app';

export function BeaconDocumentModal({ open, onClose, sourceFile }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    source_file: string;
    content: string;
    chunks: number;
    version?: number;
    is_current?: string;
    supersedes?: string;
    superseded_by?: string;
  } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { metadata, body } = data ? parseFrontmatter(data.content) : { metadata: {}, body: "" };

  useEffect(() => {
    if (!open || !sourceFile) return;
    setLoading(true);
    setError(null);
    setData(null);
    setIsEditing(false);

    fetchBeaconFileContent(sourceFile)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, sourceFile]);

  useEffect(() => {
    if (body) setEditContent(body);
  }, [body]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const fullContent = Object.keys(metadata).length > 0
        ? `---\n${Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${editContent}`
        : editContent;

      const blob = new Blob([fullContent], { type: 'text/markdown' });
      const formData = new FormData();
      formData.append('file', blob, `${sourceFile}.md`);
      formData.append('folder', metadata.category || 'processes');

      const res = await fetch(`${BEACON_API_URL}/api/ingest`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to save');

      const result = await res.json();
      toast({ title: "Document saved", description: `${result.chunks_created} chunks updated` });
      setIsEditing(false);

      const refreshed = await fetchBeaconFileContent(sourceFile);
      setData(refreshed);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="truncate">{data?.source_file || sourceFile}</span>
            {data && (
              <>
                <Badge variant="secondary" className="text-[10px]">{data.chunks} chunks</Badge>
                {data.version != null && data.version > 1 && (
                  <Badge variant="outline" className="text-[10px]">v{data.version}</Badge>
                )}
                {data.is_current === "false" && (
                  <Badge className="bg-amber-500 text-white text-[10px]">Superseded</Badge>
                )}
              </>
            )}
          </DialogTitle>
          {data?.superseded_by && (
            <p className="text-xs text-amber-600">Replaced by: {data.superseded_by}</p>
          )}
          {data?.supersedes && (
            <p className="text-xs text-muted-foreground">Replaces: {data.supersedes}</p>
          )}
          {data && Object.keys(metadata).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {metadata.category && <Badge variant="outline" className="text-[10px]">{metadata.category}</Badge>}
              {metadata.type && <Badge variant="outline" className="text-[10px]">{metadata.type}</Badge>}
              {metadata.status === "active" && <Badge className="text-[10px] bg-green-100 text-green-800 border-0">Active</Badge>}
              {metadata.date_issued && <span className="text-[10px] text-muted-foreground">Issued: {metadata.date_issued}</span>}
              {metadata.jurisdiction && <span className="text-[10px] text-muted-foreground">{metadata.jurisdiction}</span>}
            </div>
          )}
          {metadata.tags && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {metadata.tags.split(',').map(tag => (
                <Badge key={tag.trim()} variant="secondary" className="text-[10px]">{tag.trim()}</Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: "65vh" }}>
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}
          {data && !isEditing && (
            <div className="prose prose-sm max-w-none dark:prose-invert px-1">
              <ReactMarkdown>{body}</ReactMarkdown>
            </div>
          )}
          {data && isEditing && (
            <textarea
              className="w-full h-[65vh] font-mono text-sm p-3 border rounded-md resize-none bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            {data && !isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            ) : data && isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditContent(body); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save & Re-sync
                </Button>
              </>
            ) : null}
          </div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
