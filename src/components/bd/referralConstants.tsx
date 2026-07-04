import { Building2, HardHat, KeyRound, ClipboardList, MoreHorizontal } from "lucide-react";

export type ReferralStage =
  | "ASK_MADE"
  | "INTRO_RECEIVED"
  | "MEETING_SET"
  | "PROPOSAL"
  | "WON"
  | "LOST";

export type ReferralSourceType = "ARCHITECT" | "GC" | "OWNER" | "PM" | "OTHER";

export const STAGE_META: Record<ReferralStage, { label: string; className: string }> = {
  ASK_MADE: { label: "Ask Made", className: "bg-gray-100 text-gray-700 border-gray-200" },
  INTRO_RECEIVED: { label: "Intro Received", className: "bg-blue-100 text-blue-700 border-blue-200" },
  MEETING_SET: { label: "Meeting Set", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  PROPOSAL: { label: "Proposal", className: "bg-purple-100 text-purple-700 border-purple-200" },
  WON: { label: "Won", className: "bg-green-100 text-green-700 border-green-200" },
  LOST: { label: "Lost", className: "bg-red-100 text-red-700 border-red-200" },
};

export const STAGE_ORDER: ReferralStage[] = [
  "ASK_MADE",
  "INTRO_RECEIVED",
  "MEETING_SET",
  "PROPOSAL",
  "WON",
];

export const ALL_STAGES: ReferralStage[] = [
  "ASK_MADE",
  "INTRO_RECEIVED",
  "MEETING_SET",
  "PROPOSAL",
  "WON",
  "LOST",
];

export const TERMINAL_STAGES: ReferralStage[] = ["WON", "LOST"];

export const stageRank = (s: ReferralStage | null | undefined) =>
  s ? STAGE_ORDER.indexOf(s) : -1;

export const SOURCE_TYPE_META: Record<ReferralSourceType, { label: string; icon: typeof Building2 }> = {
  ARCHITECT: { label: "Architect", icon: Building2 },
  GC: { label: "GC", icon: HardHat },
  OWNER: { label: "Owner", icon: KeyRound },
  PM: { label: "PM", icon: ClipboardList },
  OTHER: { label: "Other", icon: MoreHorizontal },
};

export function isStalled(r: { next_action_at: string | null; stage: ReferralStage }): boolean {
  if (TERMINAL_STAGES.includes(r.stage)) return false;
  if (!r.next_action_at) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(r.next_action_at);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}
