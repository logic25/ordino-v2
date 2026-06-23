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
import { Loader2, Pencil, Save, History, RotateCcw, Settings2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchBeaconFileContent, FOLDER_TO_SOURCE_TYPE } from "@/services/beaconApi";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/hooks/useAuth";
import { useKbDocumentVersions, kbVersionChangerName, type KbDocumentVersion } from "@/hooks/useKbDocumentVersions";

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

/**
 * Reassembled Pinecone chunks often arrive as one long line with markdown
 * markers (##, ###, ` - `, `1. `, GFM tables) inline. ReactMarkdown only
 * recognizes those at the start of a line, so we re-insert line breaks before
 * rendering.
 */
function normalizeMarkdown(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/\r\n/g, "\n");
  // Headings: ensure ## / ### / #### start on their own line (blank line before).
  s = s.replace(/\s*(#{1,6})\s+/g, (_m, hashes) => `\n\n${hashes} `);
  // Bullet list markers mid-sentence ("foo - Bar") → newline + "- Bar"
  s = s.replace(/ - (?=[A-Z0-9*_`\[])/g, "\n- ");
  // Numbered list markers mid-line: " 1. Foo" → newline
  s = s.replace(/ (\d{1,2})\.\s+(?=[A-Z])/g, "\n$1. ");
  // GFM tables collapsed into one line:
  //   "| Header | X || ---|---| | row1 | val | | row2 | val |"
  // Strategy: insert a newline before every "|" that is preceded by " |"
  // (cell boundary) and which begins a new logical row. We detect rows by
  // looking for "| {non-pipe text} |" repeating units.
  if (/\|.+\|.+\|/.test(s)) {
    // Put each "||" cluster onto its own line (table row separators)
    s = s.replace(/\|\|/g, "|\n|");
    // Ensure separator row "| --- | --- |" sits on its own line
    s = s.replace(/\|\s*(:?-{3,}:?\s*\|)+/g, (m) => `\n${m}\n`);
    // Break after any "|" that's followed by a capital-letter cell start that
    // looks like a new row (heuristic: " | Capital ... |")
    s = s.replace(/\|\s+(?=[A-Z][^|\n]{0,80}\|)/g, "|\n| ");
  }
  // Collapse 3+ blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
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
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [panel, setPanel] = useState<"doc" | "history" | "properties">("doc");
  const [propsDraft, setPropsDraft] = useState<Record<string, string>>({});
  const versions = useKbDocumentVersions(sourceFile);
  const versionCount = versions.data?.length || 0;

  useEffect(() => {
    if (!open || !sourceFile) return;
    setLoading(true);
    setIsEditing(false);
    setPanel("doc");

    fetchBeaconFileContent(sourceFile)
      .then((data) => {
        const parsed = parseFrontmatter(data.content);
        setMetadata(parsed.metadata);
        setBody(normalizeMarkdown(parsed.body));
        setOriginalContent(data.content || "");
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

      // Snapshot the PRIOR content before re-ingesting over it, so KB edits are
      // logged (who/when) and restorable. Non-fatal: never block the save.
      try {
        if (profile?.company_id && originalContent && originalContent !== fullContent) {
          const { data: maxV } = await (supabase as any)
            .from("kb_document_versions")
            .select("version")
            .eq("source_file", sourceFile)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextVersion = ((maxV?.version as number) || 0) + 1;
          await (supabase as any).from("kb_document_versions").insert({
            company_id: profile.company_id,
            source_file: sourceFile,
            version: nextVersion,
            content: originalContent,
            changed_by: profile.id,
          });
        }
      } catch (e) {
        console.warn("[KbDocumentVersion] snapshot failed", e);
      }

      const blob = new Blob([fullContent], { type: "text/markdown" });
      const file = new File([blob], `${sourceFile}.md`, { type: "text/markdown" });

      // Use the Beacon proxy edge function for ingestion
      const { syncDocumentToBeacon } = await import("@/services/beaconApi");
      await syncDocumentToBeacon(file, file.name, metadata.category || "filing_guides");

      setBody(editContent);
      setOriginalContent(fullContent);
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["kb-document-versions", sourceFile] });
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

  // In-place metadata update via Beacon backend (NO re-ingest, NO duplicates).
  // Used by the "Properties" panel for title / folder / jurisdiction edits.
  const handleSaveProperties = async () => {
    setIsSaving(true);
    try {
      const nextMetadata = { ...metadata, ...propsDraft };
      // Strip empty values so we don't write "key: " lines
      for (const k of Object.keys(nextMetadata)) {
        if (!String(nextMetadata[k] ?? "").trim()) delete nextMetadata[k];
      }

      // Snapshot prior content for the version log (non-fatal).
      try {
        const frontmatterLines = Object.entries(nextMetadata)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        const projectedContent =
          frontmatterLines.length > 0
            ? `---\n${frontmatterLines}\n---\n\n${body}`
            : body;
        if (profile?.company_id && originalContent && originalContent !== projectedContent) {
          const { data: maxV } = await (supabase as any)
            .from("kb_document_versions")
            .select("version")
            .eq("source_file", sourceFile)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextVersion = ((maxV?.version as number) || 0) + 1;
          await (supabase as any).from("kb_document_versions").insert({
            company_id: profile.company_id,
            source_file: sourceFile,
            version: nextVersion,
            content: originalContent,
            changed_by: profile.id,
          });
        }
      } catch (e) {
        console.warn("[KbDocumentVersion] snapshot failed", e);
      }

      // ✨ In-place backend update — no re-ingest, no duplicate chunks.
      const { updateBeaconMetadata } = await import("@/services/beaconApi");
      const updatePayload: Record<string, string> = {};
      if (propsDraft.title !== undefined && propsDraft.title !== metadata.title) {
        updatePayload.title = nextMetadata.title || "";
      }
      if (propsDraft.jurisdiction !== undefined && propsDraft.jurisdiction !== metadata.jurisdiction) {
        updatePayload.jurisdiction = nextMetadata.jurisdiction || "";
      }
      if (propsDraft.category !== undefined && propsDraft.category !== metadata.category) {
        updatePayload.folder = nextMetadata.category || "";
      }
      if (Object.keys(updatePayload).length > 0) {
        await updateBeaconMetadata({ source_file: sourceFile, ...updatePayload });
      }

      setMetadata(nextMetadata);
      // Rebuild the displayed originalContent so future diffs are accurate.
      const frontmatterLines = Object.entries(nextMetadata)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      setOriginalContent(
        frontmatterLines.length > 0 ? `---\n${frontmatterLines}\n---\n\n${body}` : body
      );
      setPanel("doc");
      setPropsDraft({});
      qc.invalidateQueries({ queryKey: ["kb-document-versions", sourceFile] });
      qc.invalidateQueries({ queryKey: ["beacon-knowledge"] });
      toast({
        title: "Properties updated",
        description: "Saved in place — no duplicate chunks created.",
      });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = (v: KbDocumentVersion) => {
    const parsed = parseFrontmatter(v.content || "");
    if (Object.keys(parsed.metadata).length) setMetadata(parsed.metadata);
    setEditContent(parsed.body || v.content || "");
    setIsEditing(true);
    setPanel("doc");
    toast({ title: `Loaded version ${v.version}`, description: "Review, then Save & Re-sync to restore it." });
  };

  const displayTitle = metadata.title || sourceFile;

  const isDirty = isEditing && editContent !== body;
  const confirmDiscard = () => {
    if (!isDirty) return true;
    return window.confirm("You have unsaved changes. Discard them and close?");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (confirmDiscard()) onClose();
        }
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col"
        onPointerDownOutside={(e) => {
          if (isEditing) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isEditing) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isDirty) {
            e.preventDefault();
            if (confirmDiscard()) onClose();
          }
        }}
      >

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
          ) : panel === "history" ? (
            <div className="space-y-2 px-1">
              <p className="text-xs text-muted-foreground mb-2">
                Every saved edit snapshots the prior version here — who changed it and when.
              </p>
              {versions.isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : versionCount === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No earlier versions yet. Future edits will appear here.
                </p>
              ) : (
                versions.data!.map((v) => (
                  <div key={v.id} className="flex items-start justify-between gap-3 border rounded-md p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Version {v.version}</div>
                      <div className="text-xs text-muted-foreground">
                        {kbVersionChangerName(v)} · {format(new Date(v.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRestore(v)} className="shrink-0">
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                    </Button>
                  </div>
                ))
              )}
            </div>
          ) : panel === "properties" ? (
            <div className="space-y-4 px-1">
              <div className="rounded-md border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-3 py-2 text-xs text-foreground flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-[#f59e0b] shrink-0" />
                <div>
                  Edits below re-ingest this document into Beacon. The underlying
                  filename (<code className="text-[10px]">{sourceFile}</code>) can't be
                  renamed yet — Beacon's backend doesn't expose a rename/delete API.
                  Changing the folder writes a new chunk under the new folder; the
                  original chunk persists until backend delete ships.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Display title</label>
                <input
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={propsDraft.title ?? metadata.title ?? ""}
                  onChange={(e) => setPropsDraft((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Spring Valley Filing Guide"
                />
                <p className="text-[10px] text-muted-foreground">
                  This is what shows as the document heading and in Beacon search results.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Folder (Beacon category)</label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={propsDraft.category ?? metadata.category ?? ""}
                  onChange={(e) => setPropsDraft((p) => ({ ...p, category: e.target.value }))}
                >
                  <option value="">— select folder —</option>
                  {Object.keys(FOLDER_TO_SOURCE_TYPE).map((slug) => (
                    <option key={slug} value={slug}>
                      {slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Jurisdiction</label>
                <input
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={propsDraft.jurisdiction ?? metadata.jurisdiction ?? ""}
                  onChange={(e) => setPropsDraft((p) => ({ ...p, jurisdiction: e.target.value }))}
                  placeholder="e.g. Spring Valley, NY"
                />
                <p className="text-[10px] text-muted-foreground">
                  Free-form. Use the local jurisdiction this document applies to (e.g.
                  "NYC", "Spring Valley, NY", "Yonkers, NY").
                </p>
              </div>
            </div>
          ) : isEditing ? (
            <textarea
              className="w-full h-[55vh] font-mono text-sm p-3 border rounded-md resize-none bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert overflow-y-auto max-h-[60vh] px-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            {isEditing ? (
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
            ) : panel === "properties" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setPanel("doc"); setPropsDraft({}); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveProperties} disabled={isSaving || Object.keys(propsDraft).length === 0}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Properties
                </Button>
              </>
            ) : (
              <>
                {panel === "doc" && (
                  <>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setPropsDraft({}); setPanel("properties"); }}
                    >
                      <Settings2 className="h-4 w-4 mr-1" /> Properties
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPanel(panel === "history" ? "doc" : "history")}
                >
                  <History className="h-4 w-4 mr-1" />
                  {panel === "history" ? "Back" : "History"}
                  {panel === "doc" && versionCount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1">{versionCount}</Badge>
                  )}
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
