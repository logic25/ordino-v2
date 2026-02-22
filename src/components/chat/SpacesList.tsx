import { cn } from "@/lib/utils";
import { Hash, Users, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GChatSpace } from "@/hooks/useGoogleChat";

interface Props {
  spaces: GChatSpace[];
  isLoading: boolean;
  selectedSpaceId: string | null;
  onSelect: (spaceId: string) => void;
}

export function SpacesList({ spaces, isLoading, selectedSpaceId, onSelect }: Props) {
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
        <p className="font-medium mb-1">No spaces found</p>
        <p className="text-xs">Make sure your Google Chat App has been added to at least one space.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 p-2">
      {spaces.map((space) => {
        const isActive = selectedSpaceId === space.name;
        const isGroup = space.type === "ROOM" || space.type === "SPACE";

        return (
          <button
            key={space.name}
            onClick={() => onSelect(space.name)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-sm",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            )}
          >
            {isGroup ? <Hash className="h-4 w-4 shrink-0" /> : <Users className="h-4 w-4 shrink-0" />}
            <span className="truncate flex-1">{space.displayName || space.name}</span>
            {isGroup && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Space</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
