import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Check, X } from "lucide-react";
import {
  useEventAttendees, useAddEventAttendee,
  useUpdateEventAttendee, useRemoveEventAttendee,
} from "@/hooks/useBdEvents";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { initials } from "@/components/bd/leadConstants";

/**
 * Shared Attendees picker for a BD event. Used on the detail page and inside
 * the edit dialog so both surfaces persist via the same hooks.
 */
export function AttendeesPicker({ eventId }: { eventId: string }) {
  const attendees = useEventAttendees(eventId);
  const addAtt = useAddEventAttendee();
  const updAtt = useUpdateEventAttendee();
  const rmAtt = useRemoveEventAttendee();
  const profiles = useCompanyProfiles();
  const [pickUser, setPickUser] = useState("");

  const presentIds = new Set((attendees.data ?? []).map((a) => a.user_id));
  const available = (profiles.data ?? []).filter((p: any) => !presentIds.has(p.id));

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Select value={pickUser} onValueChange={setPickUser}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Add teammate…" /></SelectTrigger>
          <SelectContent>
            {available.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!pickUser}
          onClick={() => {
            addAtt.mutate({ event_id: eventId, user_id: pickUser });
            setPickUser("");
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        {(attendees.data ?? []).map((a) => {
          const name =
            [a.user?.first_name, a.user?.last_name].filter(Boolean).join(" ") || "Unknown";
          return (
            <div
              key={a.id}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{name}</span>
                {a.attended && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                    Attended
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title="Toggle attended"
                  onClick={() =>
                    updAtt.mutate({ id: a.id, event_id: eventId, attended: !a.attended })
                  }
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => rmAtt.mutate({ id: a.id, event_id: eventId })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {(attendees.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground py-2">No attendees yet.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Compact avatar stack for the events list "Going" column.
 */
export function AttendeeAvatarStack({
  users,
  max = 3,
}: {
  users: Array<{ id: string; first_name: string | null; last_name: string | null }>;
  max?: number;
}) {
  if (users.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
  const shown = users.slice(0, max);
  const overflow = users.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((u) => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "?";
        return (
          <Avatar key={u.id} className="h-6 w-6 ring-2 ring-background" title={name}>
            <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
          </Avatar>
        );
      })}
      {overflow > 0 && (
        <div className="h-6 w-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[10px] font-medium text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
