import { useState } from "react";
import { Bell, FileText, Mail } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useContentNotifications } from "@/hooks/useContentNotifications";

interface Props {
  onSelect: (candidateId: string) => void;
}

function priorityBadgeClasses(p: string | null) {
  switch ((p || "").toLowerCase()) {
    case "high":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "medium":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function badgeDotClass(highest: string | null) {
  switch ((highest || "").toLowerCase()) {
    case "high":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-warning text-warning-foreground";
    case "low":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-primary text-primary-foreground";
  }
}

export function ContentNotificationBell({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const { newCandidates, newCount, highestPriority, markAllRead, isLoading } =
    useContentNotifications();

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    // Mark-on-open: clears the badge the moment the user acknowledges the list.
    if (o && newCount > 0) markAllRead();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`New content candidates${newCount ? ` (${newCount})` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {newCount > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${badgeDotClass(highestPriority)}`}
            >
              {newCount > 99 ? "99+" : newCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">New content candidates</div>
            <div className="text-xs text-muted-foreground">
              {newCount === 0
                ? "You're all caught up."
                : `${newCount} new since you last checked.`}
            </div>
          </div>
          {newCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => markAllRead()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Loading…
            </div>
          ) : newCandidates.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Beacon hasn't added anything new. New candidates appear here as
              soon as they're generated.
            </div>
          ) : (
            <ul className="divide-y">
              {newCandidates.map((c) => {
                const isNewsletter = (c.content_type || "")
                  .toLowerCase()
                  .includes("news");
                const Icon = isNewsletter ? Mail : FileText;
                const qCount = c.team_questions_count ?? 0;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left p-3 hover:bg-muted/60 transition-colors"
                      onClick={() => {
                        onSelect(c.id);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${priorityBadgeClasses(c.priority)}`}
                            >
                              {c.priority || "unranked"}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {qCount} team question{qCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="text-sm font-medium truncate">
                            {c.title}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
