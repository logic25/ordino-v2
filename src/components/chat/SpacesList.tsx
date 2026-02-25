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
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[hsl(220,18%,12%)]">
      {/* Search + New Chat */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-all placeholder:text-muted-foreground/60"
            />
          </div>
          {onNewChat && (
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
              onClick={onNewChat}
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Spaces list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
        {spaces.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-3">
              <Users className="h-7 w-7 text-accent" />
            </div>
            <p className="font-semibold text-sm mb-1">No conversations found</p>
            <p className="text-xs text-muted-foreground">Your Google Chat conversations will appear here.</p>
          </div>
        ) : filteredSpaces.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No matching conversations
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <Section label="Pinned" icon={<Pin className="h-2.5 w-2.5" />} accent>
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
              </Section>
            )}

            {unpinnedDms.length > 0 && (
              <Section label="Direct Messages">
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
              </Section>
            )}

            {unpinnedGroups.length > 0 && (
              <Section label="Spaces">
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
                    overrideName={getDisplayName(space)}
                    badge
                  />
                ))}
              </Section>
            )}

            {hasNextPage && (
              <div className="px-1 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-dashed"
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

      {hiddenIds.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-accent transition-colors"
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
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRenameDialog(null)}>Cancel</Button>
              <Button size="sm" onClick={handleRenameSubmit} disabled={!renameValue.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Section Header ─── */
function Section({ label, icon, accent, children }: { label: string; icon?: React.ReactNode; accent?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className={cn(
        "px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5",
        accent ? "text-accent" : "text-muted-foreground"
      )}>
        {icon} {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/* ─── Space Icon ─── */
function getSpaceIcon(space: GChatSpace) {
  if (isSpaceGroup(space)) return <Users className="h-4 w-4 shrink-0" />;
  if (isSpaceDM(space)) return <User className="h-4 w-4 shrink-0" />;
  return <Hash className="h-4 w-4 shrink-0" />;
}

/* ─── Initials helper ─── */
function getInitials(name: string) {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ─── Space Button ─── */
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
  const displayName = overrideName || space.displayName || space.name;
  const initials = getInitials(displayName);
  const colorClass = avatarColor(displayName);

  return (
    <div className="group relative">
      <button
        onClick={() => onSelect(space.name)}
        className={cn(
          "w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-all text-sm",
          isHidden && "opacity-40",
          isActive
            ? "bg-amber-50 dark:bg-amber-500/10 text-foreground font-semibold shadow-[inset_3px_0_0_0_hsl(var(--accent))]"
            : "text-foreground/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
        )}
      >
        {/* Avatar with initials */}
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors",
          isActive ? "bg-accent/20 text-accent-foreground" : colorClass
        )}>
          {badge ? <Hash className="h-4 w-4" /> : initials}
        </div>
        <div className="flex-1 min-w-0">
          <span className="truncate block leading-tight">{displayName}</span>
        </div>
        {isPinned && <Pin className="h-3 w-3 text-accent/60 shrink-0" />}
        {badge && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 border-accent/30 text-accent font-semibold bg-accent/5">
            Space
          </Badge>
        )}
      </button>

      {/* Context menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200 dark:hover:bg-slate-700"
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
