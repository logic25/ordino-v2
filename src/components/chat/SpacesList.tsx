import { cn } from "@/lib/utils";
import { Hash, User, Users, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type GChatSpace, isSpaceDM, isSpaceGroup, isSpaceRoom } from "@/hooks/useGoogleChat";

interface Props {
  spaces: GChatSpace[];
  isLoading: boolean;
  selectedSpaceId: string | null;
  onSelect: (spaceId: string) => void;
  /** Map of space name → resolved display name (for DMs) */
  dmNames?: Map<string, string>;
}

export function SpacesList({ spaces, isLoading, selectedSpaceId, onSelect, dmNames }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground px-4">
        <p className="font-medium mb-1">No conversations found</p>
        <p className="text-xs">Your Google Chat conversations will appear here.</p>
      </div>
    );
  }

  // Split into DMs and Spaces/Groups
  const dms = spaces.filter((s) => isSpaceDM(s) || isSpaceGroup(s));
  const groups = spaces.filter((s) => isSpaceRoom(s));

  return (
    <div className="p-2 space-y-3">
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
                onSelect={onSelect}
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
                onSelect={onSelect}
                icon={<Hash className="h-4 w-4 shrink-0" />}
                badge
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpaceButton({
  space,
  isActive,
  onSelect,
  icon,
  badge,
  overrideName,
}: {
  space: GChatSpace;
  isActive: boolean;
  onSelect: (id: string) => void;
  icon: React.ReactNode;
  badge?: boolean;
  overrideName?: string;
}) {
  return (
    <button
      onClick={() => onSelect(space.name)}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-sm",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/70 hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span className="truncate flex-1">{overrideName || space.displayName || space.name}</span>
      {badge && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Space</Badge>
      )}
    </button>
  );
}
