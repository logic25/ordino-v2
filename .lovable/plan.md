# Discuss in Chat — wire-up plan

Reuse existing chat components and the `google-chat-api` `send_message` mutation. No DB changes, no new edge work. Four small frontend edits.

## 1. `src/components/chat/ChatCompose.tsx`
- Add optional prop `initialText?: string`.
- Initialize `useState(initialText ?? "")`.
- Add `useEffect` that resets `text` whenever `initialText` changes (so reopening with a new email refills the box).

## 2. `src/components/chat/ChatPanel.tsx`
- Add optional prop `initialText?: string`.
- Pass it through to `<ChatCompose initialText={initialText} ... />`.
- Keep existing behavior: when no `spaceId` is fixed, `SpacesList` renders so the user picks the destination space/DM.

## 3. `src/components/chat/ChatSlideOut.tsx`
Make it externally controllable while preserving today's uncontrolled usage:
- New optional props: `open?: boolean`, `onOpenChange?: (o: boolean) => void`, `initialText?: string`, `hideTrigger?: boolean`.
- If `open` / `onOpenChange` are provided, render `<Sheet open={open} onOpenChange={onOpenChange}>` (controlled); otherwise render `<Sheet>` as today (uncontrolled).
- If `hideTrigger` is true, do not render the `<SheetTrigger>` button.
- Pass `initialText` into `<ChatPanel initialText={initialText} ... />`.

## 4. `src/components/emails/EmailDetailSheet.tsx`
- Add `const [chatOpen, setChatOpen] = useState(false);`.
- In the email's action row (near Reply / Reminder / mark-read controls around line ~349), add a "Discuss in Chat" `Button` with a `MessageSquare` icon (lucide).
- On click, build prefill using the actual email fields present in this file:

  ```ts
  const sender = email.from_name
    ? `${email.from_name} <${email.from_email}>`
    : email.from_email || "unknown sender";
  const summary = (email.snippet || email.body_text || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const prefill = `Re: "${email.subject || "(no subject)"}" (from ${sender})${summary ? ` — ${summary}` : ""} `;
  ```

  Then `setChatOpen(true)`.
- Render the controlled instance somewhere in the sheet's JSX tree:

  ```tsx
  <ChatSlideOut
    open={chatOpen}
    onOpenChange={setChatOpen}
    hideTrigger
    initialText={prefill}
  />
  ```

The user picks the space/DM inside the panel via `SpacesList`, types/edits the prefilled message, and sends through the existing `useSendGChatMessage` mutation — no new send path.

## Out of scope
- No DB migrations, no edge function changes.
- No changes to `google-chat-api`, `useGoogleChat`, `SpacesList`, or `ChatMessageList`.
- No changelog entry required by this wiring (purely composing existing pieces), unless you want one — say the word and I'll add it.

## Verification
- Open an email → "Discuss in Chat" button visible.
- Click → side sheet opens with spaces list and composer prefilled with `Re: "<subject>" (from <sender>) — <snippet>`.
- Pick a space → message sends via existing mutation; sheet stays open showing the new message.
- Close and reopen on a different email → composer reflects the new email's prefill.
