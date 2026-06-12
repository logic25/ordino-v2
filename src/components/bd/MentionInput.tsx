import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { profileLabel } from "@/components/bd/leadConstants";

export interface MentionInputHandle {
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

/**
 * Textarea with @ autocomplete for teammates.
 * Inserts mention as token `@[Name](uuid)` so we can extract IDs on send.
 */
export const MentionInput = forwardRef<MentionInputHandle, Props>(function MentionInput(
  { value, onChange, onSubmit, placeholder, className, rows = 1 },
  ref,
) {
  const ta = useRef<HTMLTextAreaElement | null>(null);
  const profiles = useCompanyProfiles();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [trigger, setTrigger] = useState<number | null>(null); // index of @
  const [activeIdx, setActiveIdx] = useState(0);

  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus() }));

  const candidates = (profiles.data ?? [])
    .filter((p: any) => {
      const label = profileLabel(p).toLowerCase();
      return !query || label.includes(query.toLowerCase());
    })
    .slice(0, 6);

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  function detectTrigger(text: string, caret: number) {
    // Look backwards from caret for a contiguous @<word> with no whitespace
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(text[i]) && text[i] !== "@") i--;
    if (i >= 0 && text[i] === "@") {
      const after = text.slice(i + 1, caret);
      if (/^[\w .'-]{0,30}$/.test(after)) {
        setTrigger(i);
        setQuery(after);
        setOpen(true);
        return;
      }
    }
    setOpen(false);
    setTrigger(null);
    setQuery("");
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    requestAnimationFrame(() => {
      if (ta.current) detectTrigger(next, ta.current.selectionStart ?? next.length);
    });
  }

  function selectCandidate(p: any) {
    if (trigger == null || !ta.current) return;
    const name = profileLabel(p);
    const token = `@[${name}](${p.id}) `;
    const before = value.slice(0, trigger);
    const caret = ta.current.selectionStart ?? value.length;
    const after = value.slice(caret);
    const next = before + token + after;
    onChange(next);
    setOpen(false);
    setTrigger(null);
    setQuery("");
    requestAnimationFrame(() => {
      ta.current?.focus();
      const pos = before.length + token.length;
      ta.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative flex-1">
      <Textarea
        ref={ta}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (open && candidates.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % candidates.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i - 1 + candidates.length) % candidates.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              selectCandidate(candidates[activeIdx]);
              return;
            }
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
          }
          if (e.key === "Enter" && !e.shiftKey && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={className}
      />
      {open && candidates.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-64 bg-popover border rounded-md shadow-lg overflow-hidden">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pt-1.5 pb-0.5">
            Mention teammate
          </div>
          {candidates.map((p: any, i: number) => (
            <button
              key={p.id}
              type="button"
              className={`w-full text-left px-2 py-1.5 text-sm hover:bg-muted ${
                i === activeIdx ? "bg-muted" : ""
              }`}
              onMouseDown={(ev) => {
                ev.preventDefault();
                selectCandidate(p);
              }}
            >
              {profileLabel(p)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
