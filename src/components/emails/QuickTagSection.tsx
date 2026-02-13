import { cn } from "@/lib/utils";
import { QUICK_TAGS, type QuickTagName, getTagColor } from "@/hooks/useQuickTags";

interface QuickTagSectionProps {
  activeTags: string[];
  onToggle: (tag: QuickTagName) => void;
  disabled?: boolean;
}

export function QuickTagSection({ activeTags, onToggle, disabled }: QuickTagSectionProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_TAGS.map(({ name }) => {
        const isActive = activeTags.includes(name);
        return (
          <button
            key={name}
            onClick={() => onToggle(name)}
            disabled={disabled}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-full border transition-all",
              "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
              isActive
                ? getTagColor(name)
                : "bg-card text-muted-foreground border-border hover:border-foreground/20"
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
