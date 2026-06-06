const KEY = "ordino.bugReports.fixPromptDestination";

export type FixPromptDestination = "claude_code" | "lovable";

export function getDestination(): FixPromptDestination {
  if (typeof window === "undefined") return "lovable";
  const v = window.localStorage.getItem(KEY);
  return v === "claude_code" ? "claude_code" : "lovable";
}

export function setDestination(d: FixPromptDestination): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, d);
}

export const DESTINATION_LABEL: Record<FixPromptDestination, string> = {
  claude_code: "Claude Code",
  lovable: "Lovable",
};
