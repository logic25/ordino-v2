import React from "react";

// Mention token format: @[Display Name](uuid)
export const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

export function extractMentionedIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) ids.add(m[2]);
  return Array.from(ids);
}

/** Render text with @[Name](id) tokens replaced by styled chips. Preserves newlines. */
export function renderWithMentions(
  text: string,
  currentUserId?: string | null,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  const re = new RegExp(MENTION_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const isMe = currentUserId && m[2] === currentUserId;
    out.push(
      <span
        key={`m-${i++}`}
        className={`inline-flex items-center rounded px-1 text-xs font-medium align-baseline ${
          isMe ? "bg-amber-200 text-amber-900" : "bg-primary/15 text-primary"
        }`}
      >
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
