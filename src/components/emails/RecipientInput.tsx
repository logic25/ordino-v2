import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useContactSuggestions } from "@/hooks/useContactSuggestions";

interface RecipientInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export function RecipientInput({
  value,
  onChange,
  placeholder = "recipient@example.com",
  id,
  className,
}: RecipientInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useContactSuggestions(inputValue);

  const addEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
    setShowSuggestions(false);
    setHighlightedIdx(-1);
  };

  const removeEmail = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      if (highlightedIdx >= 0 && highlightedIdx < suggestions.length) {
        addEmail(suggestions[highlightedIdx].email);
      } else if (inputValue.trim()) {
        addEmail(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeEmail(value[value.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 min-h-[36px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          className
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((email) => (
          <Badge key={email} variant="secondary" className="text-xs gap-1 py-0.5 px-2">
            {email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(email);
              }}
              className="hover:opacity-70"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            setHighlightedIdx(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => {
              if (inputValue.trim()) addEmail(inputValue);
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground text-sm"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addEmail(s.email);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent/50 flex items-center justify-between gap-2",
                i === highlightedIdx && "bg-accent/50"
              )}
            >
              <div className="min-w-0">
                <span className="font-medium truncate block">{s.name}</span>
                <span className="text-xs text-muted-foreground truncate block">
                  {s.email}
                </span>
              </div>
              {s.company && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {s.company}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
