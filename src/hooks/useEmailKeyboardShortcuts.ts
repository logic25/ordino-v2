import { useEffect, useCallback } from "react";

interface UseEmailKeyboardShortcutsOptions {
  emails: { id: string }[];
  highlightedIndex: number;
  setHighlightedIndex: (i: number | ((prev: number) => number)) => void;
  onOpenEmail: (index: number) => void;
  onCloseDetail: () => void;
  onArchive: () => void;
  onOpenTagDialog: () => void;
  onFocusReply: () => void;
  onShowShortcuts: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  detailOpen: boolean;
}

export function useEmailKeyboardShortcuts({
  emails,
  highlightedIndex,
  setHighlightedIndex,
  onOpenEmail,
  onCloseDetail,
  onArchive,
  onOpenTagDialog,
  onFocusReply,
  onShowShortcuts,
  searchInputRef,
  detailOpen,
}: UseEmailKeyboardShortcutsOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // Allow '/' even when not typing, and Escape always
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === "Escape") {
        if (isTyping) {
          (document.activeElement as HTMLElement)?.blur();
          return;
        }
        onCloseDetail();
        return;
      }

      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        onShowShortcuts();
        return;
      }

      if (isTyping) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev: number) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev: number) => Math.min(emails.length - 1, prev + 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < emails.length) {
          onOpenEmail(highlightedIndex);
        }
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === "p") { e.preventDefault(); onOpenTagDialog(); return; }
      if (lower === "r" && detailOpen) { e.preventDefault(); onFocusReply(); return; }
      if (lower === "e") { e.preventDefault(); onArchive(); return; }
    },
    [emails, highlightedIndex, setHighlightedIndex, onOpenEmail, onCloseDetail, onArchive, onOpenTagDialog, onFocusReply, onShowShortcuts, searchInputRef, detailOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}
