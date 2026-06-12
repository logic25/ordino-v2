import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  StickyNote, Phone, Users, ArrowRight, Info, FileText, Mail, Pin, PinOff,
} from "lucide-react";
import {
  useBdActivities, useCreateBdActivity, useToggleBdActivityPin,
  type BdActivityFilter, type BdActivityType, type BdActivity,
} from "@/hooks/useBdActivities";
import { profileLabel, initials } from "@/components/bd/leadConstants";

const ACTIVITY_ICON: Record<BdActivityType, typeof StickyNote> = {
  NOTE: StickyNote, CALL: Phone, MEETING: Users, STAGE_CHANGE: ArrowRight,
  STATUS_CHANGE: ArrowRight, SYSTEM: Info, PROPOSAL_CREATED: FileText, EMAIL: Mail,
  APPROVAL: Info,
};

/**
 * Shared activity thread for BD entities (leads + events). Renders pinned
 * activities first, then chronological. Includes an inline "Add Note" composer.
 * Pass either leadId OR eventId (XOR enforced by the bd_activities table).
 */
export function BdActivityThread({
  filter,
  extraActions,
  emptyText = "No activity yet.",
}: {
  filter: BdActivityFilter;
  extraActions?: React.ReactNode;
  emptyText?: string;
}) {
  const { data: activities = [] } = useBdActivities(filter);
  const create = useCreateBdActivity();
  const pin = useToggleBdActivityPin();

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const pinned = activities.filter((a) => a.is_pinned);
  const rest = activities.filter((a) => !a.is_pinned);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setNoteOpen((o) => !o)}>
          <StickyNote className="mr-1.5 h-3.5 w-3.5" />Add Note
        </Button>
        {extraActions}
      </div>

      {noteOpen && (
        <Card className="p-3 space-y-2">
          <Textarea
            rows={3}
            placeholder="Write a note…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost"
              onClick={() => { setNoteOpen(false); setNoteText(""); }}>
              Cancel
            </Button>
            <Button size="sm" disabled={!noteText.trim() || create.isPending}
              onClick={async () => {
                await create.mutateAsync({ filter, type: "NOTE", content: noteText.trim() });
                setNoteText(""); setNoteOpen(false);
              }}>
              Save
            </Button>
          </div>
        </Card>
      )}

      {pinned.length > 0 && (
        <div className="space-y-2">
          {pinned.map((a) => (
            <ActivityRow key={a.id} a={a}
              onPin={() => pin.mutate({ id: a.id, filter, is_pinned: false })} />
          ))}
          <div className="border-t" />
        </div>
      )}

      <div className="space-y-2">
        {rest.length === 0 && pinned.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyText}</p>
        )}
        {rest.map((a) => (
          <ActivityRow key={a.id} a={a}
            onPin={() => pin.mutate({ id: a.id, filter, is_pinned: true })} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ a, onPin }: { a: BdActivity; onPin: () => void }) {
  const Icon = ACTIVITY_ICON[a.type] ?? Info;
  const author = a.author ? profileLabel(a.author) : "System";
  return (
    <div className="flex gap-2 group">
      <div className="mt-0.5"><Icon className="h-4 w-4 text-muted-foreground" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px]">{initials(author)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{author}</span>
          <span>· {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
          <button className="ml-auto opacity-0 group-hover:opacity-100"
            onClick={onPin} aria-label="Pin">
            {a.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
        </div>
        {a.content && <p className="text-sm whitespace-pre-wrap mt-0.5">{a.content}</p>}
        {a.type === "CALL" && a.metadata?.duration_minutes != null && (
          <p className="text-xs text-muted-foreground">{a.metadata.duration_minutes} min</p>
        )}
      </div>
    </div>
  );
}
