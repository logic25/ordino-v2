import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeoSearchResult {
  label: string;
  borough: string;
  zip: string;
  housenumber: string;
  street: string;
  bbl?: string;
  bin?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: GeoSearchResult) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
  className,
  id,
  disabled,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const url = `https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(query)}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const results: GeoSearchResult[] = (data?.features || []).slice(0, 6).map((f: any) => {
          const props = f.properties;
          const pad = props?.addendum?.pad;
          return {
            label: props?.label || props?.name || "",
            borough: props?.borough || "",
            zip: props?.postalcode || "",
            housenumber: props?.housenumber || "",
            street: props?.street || "",
            bbl: pad?.bbl || undefined,
            bin: pad?.bin || undefined,
          };
        });
        setSuggestions(results);
        setHighlightedIndex(-1);
        setShowDropdown(results.length > 0);
      }
    } catch {
      // silently fail
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(val), 250);
  };

  const handleSelect = (result: GeoSearchResult) => {
    onChange(result.label);
    setShowDropdown(false);
    setSuggestions([]);
    onSelect?.(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={handleChange}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pr-8", className)}
          disabled={disabled}
          autoComplete="off"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[9999] bg-popover border rounded-md shadow-xl max-h-[240px] overflow-y-auto">
          {suggestions.map((result, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2.5 text-sm flex items-start gap-2 border-b last:border-0 transition-colors",
                i === highlightedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{result.label}</div>
                {result.borough && (
                  <div className="text-xs text-muted-foreground">
                    {result.borough}
                    {result.zip && ` · ${result.zip}`}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
