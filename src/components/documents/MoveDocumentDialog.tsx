import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, FolderOpen, ChevronRight, ChevronDown, Brain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentFolder } from "@/hooks/useDocumentFolders";
import { buildFolderTree, type FolderTreeNode } from "@/hooks/useDocumentFolders";
import type { UniversalDocument } from "@/hooks/useUniversalDocuments";

interface PickerNodeProps {
  folder: FolderTreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabledIds?: Set<string>;
  depth?: number;
}

function PickerNode({ folder, selectedId, onSelect, disabledIds, depth = 0 }: PickerNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = folder.children.length > 0;
  const isSelected = selectedId === folder.id;
  const disabled = disabledIds?.has(folder.id);

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onSelect(folder.id);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted",
          isSelected && "bg-muted font-medium",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-3.5" />
        )}
        {folder.is_beacon_synced ? (
          <Brain className="h-4 w-4 shrink-0 text-[#f59e0b]" />
        ) : isSelected || expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-left flex-1">{folder.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <PickerNode
              key={child.id}
              folder={child}
              selectedId={selectedId}
              onSelect={onSelect}
              disabledIds={disabledIds}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MoveDocumentDialogProps {
  document: UniversalDocument | null;
  folders: DocumentFolder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (folderId: string | null) => Promise<void>;
  pending?: boolean;
}

export function MoveDocumentDialog({
  document, folders, open, onOpenChange, onMove, pending,
}: MoveDocumentDialogProps) {
  const [target, setTarget] = useState<string | null>(null);
  const tree = buildFolderTree(folders);

  useEffect(() => {
    if (open) setTarget(document?.folder_id ?? null);
  }, [open, document?.folder_id]);

  const currentFolder = folders.find((f) => f.id === document?.folder_id);
  const isSame = target === (document?.folder_id ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move "{document?.title}"</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">
          Current folder: <span className="font-medium text-foreground">{currentFolder?.name || "All Documents (no folder)"}</span>
        </div>
        <div className="border rounded-md p-2 max-h-[360px] overflow-y-auto space-y-0.5">
          <button
            type="button"
            onClick={() => setTarget(null)}
            className={cn(
              "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors",
              target === null && "bg-muted font-medium",
            )}
          >
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>All Documents (no folder)</span>
          </button>
          {tree.map((folder) => (
            <PickerNode
              key={folder.id}
              folder={folder}
              selectedId={target}
              onSelect={setTarget}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button
            onClick={() => onMove(target)}
            disabled={pending || isSame}
          >
            {pending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
