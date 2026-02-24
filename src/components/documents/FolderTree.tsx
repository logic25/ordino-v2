import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Brain, MoreVertical, Pencil, FolderPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { DocumentFolder } from "@/hooks/useDocumentFolders";
import { buildFolderTree, type FolderTreeNode } from "@/hooks/useDocumentFolders";

interface FolderNodeProps {
  folder: FolderTreeNode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRename?: (folder: DocumentFolder) => void;
  onCreateSubfolder?: (parentId: string) => void;
  onDelete?: (folder: DocumentFolder) => void;
  depth?: number;
}

function FolderNode({ folder, selectedId, onSelect, onRename, onCreateSubfolder, onDelete, depth = 0 }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = folder.children.length > 0;
  const isSelected = selectedId === folder.id;
  const canDelete = !folder.is_system;

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

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <span
              className="h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 shrink-0 rounded hover:bg-accent cursor-pointer"
              role="button"
              tabIndex={-1}
            >
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename?.(folder); }}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateSubfolder?.(folder.id); }}>
              <FolderPlus className="h-3.5 w-3.5 mr-2" /> Create Subfolder
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(folder); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </button>
      {expanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onRename={onRename}
              onCreateSubfolder={onCreateSubfolder}
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
  onRenameFolder?: (folder: DocumentFolder) => void;
  onCreateSubfolder?: (parentId: string) => void;
  onDeleteFolder?: (folder: DocumentFolder) => void;
}

export function FolderTree({ folders, selectedFolderId, onSelectFolder, onRenameFolder, onCreateSubfolder, onDeleteFolder }: FolderTreeProps) {
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
          onRename={onRenameFolder}
          onCreateSubfolder={onCreateSubfolder}
          onDelete={onDeleteFolder}
        />
      ))}
    </div>
  );
}
