import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Hash, User, Users, Loader2, Search, EyeOff, Eye, Plus, Pin, PinOff, MoreVertical, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type GChatSpace, isSpaceDM, isSpaceGroup, isSpaceRoom } from "@/hooks/useGoogleChat";

interface Props {
  spaces: GChatSpace[];
  isLoading: boolean;
  selectedSpaceId: string | null;
  onSelect: (spaceId: string) => void;
  dmNames?: Map<string, string>;
  nicknames?: Map<string, string>;
  hiddenIds?: string[];
  pinnedIds?: string[];
  onHide?: (spaceId: string) => void;
  onUnhide?: (spaceId: string) => void;
  onPin?: (spaceId: string) => void;
  onUnpin?: (spaceId: string) => void;
  onRename?: (opts: { spaceId: string; nickname: string }) => void;
  onNewChat?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function SpacesList({
  spaces, isLoading, selectedSpaceId, onSelect, dmNames, nicknames,
  hiddenIds = [], pinnedIds = [],
  onHide, onUnhide, onPin, onUnpin, onRename,
  onNewChat, hasNextPage, isFetchingNextPage, onLoadMore,
}: Props) {
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ spaceId: string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const getDisplayName = (s: GChatSpace) =>
    nicknames?.get(s.name) || s.displayName || dmNames?.get(s.name) || s.name;

  const filteredSpaces = useMemo(() => {
    let list = spaces;
    if (!showHidden) {
      list = list.filter((s) => !hiddenSet.has(s.name));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => getDisplayName(s).toLowerCase().includes(q));
    }
    return list;
  }, [spaces, search, showHidden, hiddenSet, dmNames, nicknames]);

  const pinned = filteredSpaces.filter((s) => pinnedSet.has(s.name));
  const unpinnedDms = filteredSpaces.filter((s) => !pinnedSet.has(s.name) && (isSpaceDM(s) || isSpaceGroup(s)));
  const unpinnedGroups = filteredSpaces.filter((s) => !pinnedSet.has(s.name) && isSpaceRoom(s));

  const handleRenameSubmit = () => {
    if (renameDialog && renameValue.trim() && onRename) {
      onRename({ spaceId: renameDialog.spaceId, nickname: renameValue.trim() });
    }
    setRenameDialog(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search + New Chat */}
      <div className="px-3 pt-2 pb-1 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
          {onNewChat && (
            <Button variant="default" size="icon" className="h-7 w-7 shrink-0 rounded-lg" onClick={onNewChat} title="New chat">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Spaces list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {spaces.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground px-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <p className="font-medium mb-1">No conversations found</p>
            <p className="text-xs">Your Google Chat conversations will appear here.</p>
          </div>
        ) : filteredSpaces.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No matching conversations
          </div>
        ) : (
          <>
            {/* Pinned section */}
            {pinned.length > 0 && (
              <div>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary/70 flex items-center gap-1.5">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </p>
                <div className="space-y-0.5">
                  {pinned.map((space) => (
                    <SpaceButton
                      key={space.name}
                      space={space}
                      isActive={selectedSpaceId === space.name}
                      isHidden={hiddenSet.has(space.name)}
                      isPinned
                      onSelect={onSelect}
                      onHide={onHide}
                      onUnhide={onUnhide}
                      onPin={onPin}
                      onUnpin={onUnpin}
                      onRename={onRename ? (spaceId) => {
                        setRenameValue(getDisplayName(space));
                        setRenameDialog({ spaceId, currentName: getDisplayName(space) });
                      } : undefined}
                      icon={getSpaceIcon(space)}
                      overrideName={getDisplayName(space)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* DMs section */}
            {unpinnedDms.length > 0 && (
              <div>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground/50">
                  Direct Messages
                </p>
                <div className="space-y-0.5">
                  {unpinnedDms.map((space) => (
                    <SpaceButton
                      key={space.name}
                      space={space}
                      isActive={selectedSpaceId === space.name}
                      isHidden={hiddenSet.has(space.name)}
                      isPinned={false}
                      onSelect={onSelect}
                      onHide={onHide}
                      onUnhide={onUnhide}
                      onPin={onPin}
                      onUnpin={onUnpin}
                      onRename={onRename ? (spaceId) => {
                        setRenameValue(getDisplayName(space));
                        setRenameDialog({ spaceId, currentName: getDisplayName(space) });
                      } : undefined}
                      icon={getSpaceIcon(space)}
                      overrideName={getDisplayName(space)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Spaces section */}
            {unpinnedGroups.length > 0 && (
              <div>
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground/50">
                  Spaces
                </p>
                <div className="space-y-0.5">
                  {unpinnedGroups.map((space) => (
                    <SpaceButton
                      key={space.name}
                      space={space}
                      isActive={selectedSpaceId === space.name}
                      isHidden={hiddenSet.has(space.name)}
                      isPinned={false}
                      onSelect={onSelect}
                      onHide={onHide}
                      onUnhide={onUnhide}
                      onPin={onPin}
                      onUnpin={onUnpin}
                      onRename={onRename ? (spaceId) => {
                        setRenameValue(getDisplayName(space));
                        setRenameDialog({ spaceId, currentName: getDisplayName(space) });
                      } : undefined}
                      icon={<Hash className="h-4 w-4 shrink-0" />}
                      badge
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Load More */}
            {hasNextPage && (
              <div className="px-3 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={onLoadMore}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Loading...</>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Show hidden toggle */}
      {hiddenIds.length > 0 && (
        <div className="px-3 py-2 border-t">
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {showHidden ? "Hide archived" : `Show ${hiddenIds.length} archived`}
          </button>
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(open) => !open && setRenameDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter a nickname..."
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRenameDialog(null)}>Cancel</Button>
              <Button size="sm" onClick={handleRenameSubmit} disabled={!renameValue.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getSpaceIcon(space: GChatSpace) {
  if (isSpaceGroup(space)) return <Users className="h-4 w-4 shrink-0 text-primary/70" />;
  if (isSpaceDM(space)) return <User className="h-4 w-4 shrink-0 text-primary/70" />;
  return <Hash className="h-4 w-4 shrink-0 text-primary/70" />;
}

function SpaceButton({
  space, isActive, isHidden, isPinned,
  onSelect, onHide, onUnhide, onPin, onUnpin, onRename,
  icon, badge, overrideName,
}: {
  space: GChatSpace;
  isActive: boolean;
  isHidden: boolean;
  isPinned: boolean;
  onSelect: (id: string) => void;
  onHide?: (id: string) => void;
  onUnhide?: (id: string) => void;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onRename?: (id: string) => void;
  icon: React.ReactNode;
  badge?: boolean;
  overrideName?: string;
}) {
  return (
    <div className="group relative">
      <button
        onClick={() => onSelect(space.name)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-sm",
          isHidden && "opacity-40",
          isActive
            ? "bg-primary/15 text-primary font-semibold shadow-sm ring-1 ring-primary/20"
            : "text-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isActive ? "bg-primary/20" : "bg-muted"
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="truncate block">{overrideName || space.displayName || space.name}</span>
        </div>
        {isPinned && <Pin className="h-3 w-3 text-primary/50 shrink-0" />}
        {badge && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 bg-primary/10 text-primary border-0">Space</Badge>
        )}
      </button>

      {/* Context menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted-foreground/10"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {onRename && (
            <DropdownMenuItem onClick={() => onRename(space.name)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
          )}
          {isPinned ? (
            <DropdownMenuItem onClick={() => onUnpin?.(space.name)}>
              <PinOff className="h-3.5 w-3.5 mr-2" />
              Unpin
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onPin?.(space.name)}>
              <Pin className="h-3.5 w-3.5 mr-2" />
              Pin
            </DropdownMenuItem>
          )}
          {isHidden ? (
            <DropdownMenuItem onClick={() => onUnhide?.(space.name)}>
              <Eye className="h-3.5 w-3.5 mr-2" />
              Unhide
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onHide?.(space.name)}>
              <EyeOff className="h-3.5 w-3.5 mr-2" />
              Hide
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
