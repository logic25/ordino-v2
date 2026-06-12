import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowRight, FileText, Info, Mail, Pin, PinOff, Send,
} from "lucide-react";
import {
  useBdActivities, useCreateBdActivity, useToggleBdActivityPin,
  type BdActivityFilter, type BdActivityType, type BdActivity,
} from "@/hooks/useBdActivities";
import { useAuth } from "@/hooks/useAuth";
import { profileLabel, initials } from "@/components/bd/leadConstants";
import { MentionInput, type MentionInputHandle } from "@/components/bd/MentionInput";
import { extractMentionedIds, renderWithMentions } from "@/components/bd/mentions";

const SYSTEM_TYPES = new Set<BdActivityType>([
  "STAGE_CHANGE", "STATUS_CHANGE", "SYSTEM", "PROPOSAL_CREATED", "EMAIL", "APPROVAL",
]);

const SYSTEM_ICON: Partial<Record<BdActivityType, typeof ArrowRight>> = {
  STAGE_CHANGE: ArrowRight,
  STATUS_CHANGE: ArrowRight,
  SYSTEM: Info,
  PROPOSAL_CREATED: FileText,
  EMAIL: Mail,
  APPROVAL: Info,
};

/**
 * Shared chat-style discussion thread for BD entities (leads + events).
 * - Persistent composer pinned at the bottom (Enter to send, Shift+Enter newline)
 * - User vs other-author bubble layout
 * - System events render as inline dividers, not bubbles
 * - Auto-scrolls to bottom on mount + on new messages
 *
 * Pass either leadId OR eventId via `filter`.
 */
export function BdActivityThread({
  filter,
  extraActions,
  emptyText = "Start the conversation about this work.",
}: {
  filter: BdActivityFilter;
  extraActions?: React.ReactNode;
  emptyText?: string;
}) {
  const { profile } = useAuth();
  const { data: activities = [] } = useBdActivities(filter);
  const create = useCreateBdActivity();
  const pin = useToggleBdActivityPin();

  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<MentionInputHandle | null>(null);

  // useBdActivities returns newest-first; we render oldest-first for chat.
  const ordered = [...activities].reverse();
  const pinned = ordered.filter((a) => a.is_pinned);
  const chronological = ordered.filter((a) => !a.is_pinned);

  // Auto-scroll to bottom on mount and on new activity count.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activities.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || create.isPending) return;
    const mentioned_user_ids = extractMentionedIds(text);
    await create.mutateAsync({ filter, type: "NOTE", content: text, mentioned_user_ids });
    setDraft("");
    composerRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[600px]">
      {extraActions && (
        <div className="flex items-center gap-2 flex-wrap pb-3 border-b mb-3">
          {extraActions}
        </div>
      )}

      <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {pinned.length > 0 && (
          <div className="space-y-2 pb-2 border-b">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1">
              <Pin className="h-3 w-3" />Pinned
            </p>
            {pinned.map((a) =>
              SYSTEM_TYPES.has(a.type) ? (
                <SystemRow key={a.id} a={a} />
              ) : (
                <MessageBubble
                  key={a.id}
                  a={a}
                  isOwn={a.created_by === profile?.id}
                  currentUserId={profile?.id}
                  onTogglePin={() =>
                    pin.mutate({ id: a.id, filter, is_pinned: false })
                  }
                />
              ),
            )}
          </div>
        )}

        {chronological.length === 0 && pinned.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">{emptyText}</p>
        )}

        {chronological.map((a) =>
          SYSTEM_TYPES.has(a.type) ? (
            <SystemRow key={a.id} a={a} />
          ) : (
            <MessageBubble
              key={a.id}
              a={a}
              isOwn={a.created_by === profile?.id}
              currentUserId={profile?.id}
              onTogglePin={() => pin.mutate({ id: a.id, filter, is_pinned: true })}
            />
          ),
        )}
      </div>

      <div className="pt-3 border-t mt-3">
        <div className="flex items-end gap-2">
          <MentionInput
            ref={composerRef}
            placeholder="Message the team… use @ to tag a teammate"
            value={draft}
            onChange={setDraft}
            onSubmit={send}
            rows={1}
            className="resize-none min-h-[36px] max-h-32"
          />
          <Button
            size="icon"
            disabled={!draft.trim() || create.isPending}
            onClick={send}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Enter to send · Shift+Enter for newline · @ to mention
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  a,
  isOwn,
  onTogglePin,
  currentUserId,
}: {
  a: BdActivity;
  isOwn: boolean;
  onTogglePin: () => void;
  currentUserId?: string | null;
}) {
  const author = a.author ? profileLabel(a.author) : "System";
  const displayName = isOwn ? "You" : author;
  return (
    <div className={`flex gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-7 w-7 shrink-0 mt-4">
        <AvatarFallback className={`text-[10px] ${isOwn ? "bg-primary/15 text-primary" : ""}`}>{initials(author)}</AvatarFallback>
      </Avatar>
      <div className={`flex flex-col max-w-[80%] ${isOwn ? "items-end" : "items-start"}`}>
        <div className="text-[10px] text-muted-foreground mb-0.5 px-1 flex items-center gap-1.5">
          <span className="font-medium text-foreground">{displayName}</span>
          <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
          {a.is_pinned && <Pin className="h-2.5 w-2.5" />}
        </div>
        <div
          className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted rounded-bl-sm"
          }`}
        >
          {a.content
            ? renderWithMentions(a.content, currentUserId)
            : <span className="opacity-60 italic">(empty)</span>}
          {a.type === "CALL" && a.metadata?.duration_minutes != null && (
            <p className="text-[10px] opacity-70 mt-1">
              📞 Call · {a.metadata.duration_minutes} min
            </p>
          )}
          {a.type === "MEETING" && a.metadata?.location && (
            <p className="text-[10px] opacity-70 mt-1">
              📍 {a.metadata.location}
            </p>
          )}
        </div>
        <button
          className={`text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 px-1 hover:text-foreground transition ${
            isOwn ? "" : "self-start"
          }`}
          onClick={onTogglePin}
          title={a.is_pinned ? "Unpin" : "Pin"}
        >
          {a.is_pinned ? (
            <span className="inline-flex items-center gap-0.5">
              <PinOff className="h-2.5 w-2.5" />Unpin
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5">
              <Pin className="h-2.5 w-2.5" />Pin
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function SystemRow({ a }: { a: BdActivity }) {
  const Icon = SYSTEM_ICON[a.type] ?? Info;
  const author = a.author ? profileLabel(a.author) : "System";
  return (
    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground justify-center">
      <div className="flex-1 border-t" />
      <div className="flex items-center gap-1.5 px-2">
        <Icon className="h-3 w-3" />
        <span>
          <span className="font-medium text-foreground/80">{author}</span>
          {a.content ? ` ${a.content}` : ""}
        </span>
        <span>· {format(new Date(a.created_at), "MMM d, h:mm a")}</span>
      </div>
      <div className="flex-1 border-t" />
    </div>
  );
}
