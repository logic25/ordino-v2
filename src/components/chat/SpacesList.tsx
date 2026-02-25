import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Hash, User, Users, Loader2, Search, EyeOff, Eye, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type GChatSpace, isSpaceDM, isSpaceGroup, isSpaceRoom } from "@/hooks/useGoogleChat";

interface Props {
  spaces: GChatSpace[];
  isLoading: boolean;
  selectedSpaceId: string | null;
  onSelect: (spaceId: string) => void;
  dmNames?: Map<string, string>;
  hiddenIds?: string[];
  onHide?: (spaceId: string) => void;
  onUnhide?: (spaceId: string) => void;
  onNewChat?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function SpacesList({ spaces, isLoading, selectedSpaceId, onSelect, dmNames, hiddenIds = [], onHide, onUnhide, onNewChat, hasNextPage, isFetchingNextPage, onLoadMore }: Props) {
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);

  const filteredSpaces = useMemo(() => {
    let list = spaces;
    if (!showHidden) {
      list = list.filter((s) => !hiddenSet.has(s.name));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const name = s.displayName || dmNames?.get(s.name) || s.name;
        return name.toLowerCase().includes(q);
      });
    }
    return list;
  }, [spaces, search, showHidden, hiddenSet, dmNames]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Split into DMs and Spaces/Groups
  const dms = filteredSpaces.filter((s) => isSpaceDM(s) || isSpaceGroup(s));
  const groups = filteredSpaces.filter((s) => isSpaceRoom(s));

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
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/50 border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {onNewChat && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onNewChat} title="New chat">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Spaces list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {spaces.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground px-4">
            <p className="font-medium mb-1">No conversations found</p>
            <p className="text-xs">Your Google Chat conversations will appear here.</p>
          </div>
        ) : filteredSpaces.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No matching conversations
          </div>
        ) : (
          <>
            {dms.length > 0 && (
              <div>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Direct Messages
                </p>
                <div className="space-y-0.5">
                  {dms.map((space) => (
                    <SpaceButton
                      key={space.name}
                      space={space}
                      isActive={selectedSpaceId === space.name}
                      isHidden={hiddenSet.has(space.name)}
                      onSelect={onSelect}
                      onHide={onHide}
                      onUnhide={onUnhide}
                      icon={isSpaceGroup(space) ? <Users className="h-4 w-4 shrink-0" /> : <User className="h-4 w-4 shrink-0" />}
                      overrideName={space.displayName || dmNames?.get(space.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {groups.length > 0 && (
              <div>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Spaces
                </p>
                <div className="space-y-0.5">
                  {groups.map((space) => (
                    <SpaceButton
                      key={space.name}
                      space={space}
                      isActive={selectedSpaceId === space.name}
                      isHidden={hiddenSet.has(space.name)}
                      onSelect={onSelect}
                      onHide={onHide}
                      onUnhide={onUnhide}
                      icon={<Hash className="h-4 w-4 shrink-0" />}
                      badge
                    />
                  ))}
                </div>
              </div>
            )}
            {/* Load More button */}
            {hasNextPage && (
              <div className="px-3 py-2">
                <Button
                  variant="ghost"
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
    </div>
  );
}

function SpaceButton({
  space,
  isActive,
  isHidden,
  onSelect,
  onHide,
  onUnhide,
  icon,
  badge,
  overrideName,
}: {
  space: GChatSpace;
  isActive: boolean;
  isHidden: boolean;
  onSelect: (id: string) => void;
  onHide?: (id: string) => void;
  onUnhide?: (id: string) => void;
  icon: React.ReactNode;
  badge?: boolean;
  overrideName?: string;
}) {
  return (
    <div className="group relative">
      <button
        onClick={() => onSelect(space.name)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-sm",
          isHidden && "opacity-50",
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground/70 hover:bg-muted hover:text-foreground"
        )}
      >
        {icon}
        <div className="flex-1 min-w-0">
          <span className="truncate block">{overrideName || space.displayName || space.name}</span>
        </div>
        {badge && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Space</Badge>
        )}
      </button>

      {/* Hide/unhide button on hover */}
      {(onHide || onUnhide) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isHidden) onUnhide?.(space.name);
            else onHide?.(space.name);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted-foreground/10"
          title={isHidden ? "Unhide" : "Hide"}
        >
          {isHidden ? <Eye className="h-3 w-3 text-muted-foreground" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
        </button>
      )}
    </div>
  );
}
