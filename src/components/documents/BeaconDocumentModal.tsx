import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Save } from "lucide-react";
import { fetchBeaconFileContent } from "@/services/beaconApi";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

/**
 * Parse YAML frontmatter from document content.
 * Handles BOTH formats:
 *   1. Multi-line:  ---\ntitle: X\ncategory: Y\n---\n
 *   2. Single-line: --- title: X category: Y ---  (from Pinecone chunk reassembly)
 */
function parseFrontmatter(raw: string): {
  metadata: Record<string, string>;
  body: string;
} {
  if (!raw) return { metadata: {}, body: "" };

  // Format 1: Multi-line frontmatter (newline-separated)
  if (raw.startsWith("---\n") || raw.startsWith("---\r\n")) {
    const endIdx = raw.indexOf("\n---", 3);
    if (endIdx !== -1) {
      const block = raw.substring(4, endIdx).trim();
      const body = raw.substring(endIdx + 4).trim();
      const metadata: Record<string, string> = {};
      for (const line of block.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim();
          const val = line.substring(colonIdx + 1).trim();
          if (val && val !== "null") metadata[key] = val;
        }
      }
      return { metadata, body };
    }
  }

  // Format 2: Single-line frontmatter (spaces instead of newlines)
  const singleLineMatch = raw.match(/^---\s+(.+?)\s+---\s*([\s\S]*)$/);
  if (singleLineMatch) {
    const block = singleLineMatch[1];
    const body = singleLineMatch[2].trim();
    const metadata: Record<string, string> = {};

    const knownKeys = [
      "title", "category", "type", "date_issued", "jurisdiction",
      "status", "tags", "notice_number", "supersedes", "superseded_by",
      "building_bulletin", "effective_date",
    ];

    const keyPattern = new RegExp(`(?:^|\\s)(${knownKeys.join("|")}):\\s*`, "g");
    let lastKey = "";
    let lastStart = 0;
    const entries: { key: string; start: number; end: number }[] = [];

    keyPattern.lastIndex = 0;
    let match;
    while ((match = keyPattern.exec(block)) !== null) {
      if (lastKey) {
        entries.push({ key: lastKey, start: lastStart, end: match.index });
      }
      lastKey = match[1];
      lastStart = match.index + match[0].length;
    }
    if (lastKey) {
      entries.push({ key: lastKey, start: lastStart, end: block.length });
    }

    for (const entry of entries) {
      const val = block.substring(entry.start, entry.end).trim();
      if (val && val !== "null") metadata[entry.key] = val;
    }

    return { metadata, body };
  }

  // No frontmatter detected
  return { metadata: {}, body: raw };
}

interface BeaconDocumentModalProps {
  open: boolean;
  onClose: () => void;
  sourceFile: string;
}

export function BeaconDocumentModal({
  open,
  onClose,
  sourceFile,
}: BeaconDocumentModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !sourceFile) return;
    setLoading(true);
    setIsEditing(false);

    fetchBeaconFileContent(sourceFile)
      .then((data) => {
        const parsed = parseFrontmatter(data.content);
        setMetadata(parsed.metadata);
        setBody(parsed.body);
      })
      .catch((err) => {
        toast({
          title: "Failed to load document",
          description: err.message,
          variant: "destructive",
        });
        setBody("Failed to load document content.");
      })
      .finally(() => setLoading(false));
  }, [open, sourceFile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const frontmatterLines = Object.entries(metadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      const fullContent =
        frontmatterLines.length > 0
          ? `---\n${frontmatterLines}\n---\n\n${editContent}`
          : editContent;

      const blob = new Blob([fullContent], { type: "text/markdown" });
      const formData = new FormData();
      formData.append("file", blob, `${sourceFile}.md`);
      formData.append("folder", metadata.category || "filing_guides");

      const BEACON_API_URL =
        import.meta.env.VITE_BEACON_API_URL ||
        "https://beaconrag.up.railway.app";
      const res = await fetch(`${BEACON_API_URL}/api/ingest`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Save failed");

      setBody(editContent);
      setIsEditing(false);
      toast({
        title: "Document saved",
        description: "Changes synced to Beacon knowledge base",
      });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayTitle = metadata.title || sourceFile;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="truncate">{displayTitle}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Metadata badges */}
        {Object.keys(metadata).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {metadata.category && (
              <Badge variant="outline" className="text-[10px]">
                {metadata.category.replace(/_/g, " ")}
              </Badge>
            )}
            {metadata.type && (
              <Badge variant="outline" className="text-[10px]">
                {metadata.type.replace(/_/g, " ")}
              </Badge>
            )}
            {metadata.status === "active" && (
              <Badge variant="secondary" className="text-[10px] bg-success/10 text-success">
                Active
              </Badge>
            )}
            {metadata.date_issued && (
              <span className="text-[10px] text-muted-foreground">
                Issued: {metadata.date_issued}
              </span>
            )}
            {metadata.jurisdiction && (
              <span className="text-[10px] text-muted-foreground">
                {metadata.jurisdiction}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: "65vh" }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isEditing ? (
            <textarea
              className="w-full h-[55vh] font-mono text-sm p-3 border rounded-md resize-none bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert overflow-y-auto max-h-[60vh] px-1">
              <ReactMarkdown>{body}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(true);
                  setEditContent(body);
                }}
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save & Re-sync
                </Button>
              </>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
