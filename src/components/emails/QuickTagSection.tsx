import { cn } from "@/lib/utils";
import { QUICK_TAGS, type QuickTagName, getTagColor } from "@/hooks/useQuickTags";
import { Check } from "lucide-react";

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
              "px-2.5 py-1 text-xs font-medium rounded-full border transition-all inline-flex items-center gap-1",
              "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
              isActive
                ? cn(getTagColor(name), "ring-1 ring-offset-1 ring-current shadow-sm")
                : "bg-card text-muted-foreground border-border hover:border-foreground/20"
            )}
          >
            {isActive && <Check className="h-3 w-3" />}
            {name}
          </button>
        );
      })}
    </div>
  );
}
