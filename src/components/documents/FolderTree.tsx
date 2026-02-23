import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Brain, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DocumentFolder } from "@/hooks/useDocumentFolders";
import { buildFolderTree, type FolderTreeNode } from "@/hooks/useDocumentFolders";

interface FolderNodeProps {
  folder: FolderTreeNode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete?: (folder: DocumentFolder) => void;
  depth?: number;
}

function FolderNode({ folder, selectedId, onSelect, onDelete, depth = 0 }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = folder.children.length > 0;
  const isSelected = selectedId === folder.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(folder.id);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors group",
          isSelected && "bg-muted font-medium"
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
        {!folder.is_system && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
            onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FolderTreeProps {
  folders: DocumentFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onDeleteFolder?: (folder: DocumentFolder) => void;
}

export function FolderTree({ folders, selectedFolderId, onSelectFolder, onDeleteFolder }: FolderTreeProps) {
  const tree = buildFolderTree(folders);

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelectFolder(null)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors",
          selectedFolderId === null && "bg-muted font-medium"
        )}
      >
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>All Documents</span>
      </button>
      {tree.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          selectedId={selectedFolderId}
          onSelect={onSelectFolder}
          onDelete={onDeleteFolder}
        />
      ))}
    </div>
  );
}
