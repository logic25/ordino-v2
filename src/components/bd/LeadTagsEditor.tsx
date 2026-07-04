import { useState, useEffect, useRef } from "react";
import { X, Plus, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Free-form tag chips for a lead. Common uses: persona/role markers
 * ("architect", "GC", "owner", "referral partner", "investor"), or
 * domain themes ("FISP", "LL97", "new-build"). Drives the
 * "Suggested matches" sidebar.
 *
 * Tags are normalized to lowercase-trimmed strings; duplicates collapsed.
 */
export function LeadTagsEditor({
  tags,
  onChange,
  className,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const norm = (s: string) => s.trim().toLowerCase();
  const commit = () => {
    const v = norm(draft);
    if (v && !tags.map(norm).includes(v)) {
      onChange([...tags, v]);
    }
    setDraft("");
    setAdding(false);
  };

  const remove = (t: string) => {
    onChange(tags.filter((x) => x !== t));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <TagIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      {tags.length === 0 && !adding && (
        <span className="text-xs text-slate-400 italic mr-1">No tags</span>
      )}
      {tags.map((t) => (
        <Badge
          key={t}
          variant="outline"
          className="rounded-full pl-2 pr-1 py-0.5 gap-1 bg-amber-50/60 border-amber-200 text-amber-900 text-[11px] font-medium"
        >
          {t}
          <button
            type="button"
            onClick={() => remove(t)}
            className="rounded-full hover:bg-amber-200/60 p-0.5"
            aria-label={`Remove ${t}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(""); setAdding(false); }
          }}
          placeholder="add tag…"
          className="h-6 w-28 rounded-full border border-slate-300 px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Plus className="h-2.5 w-2.5" /> Tag
        </button>
      )}
    </div>
  );
}
