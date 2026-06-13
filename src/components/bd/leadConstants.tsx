import {
  CalendarDays, Users, Phone, Mail, Globe, Search, Snowflake, MoreHorizontal, Handshake,
} from "lucide-react";
import type { LeadStage, LeadSourceType, LeadTimeline } from "@/hooks/useLeads";

// Stage pill colors per spec.
export const STAGE_META: Record<LeadStage, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-gray-100 text-gray-700 border-gray-200" },
  CONTACTED: { label: "Contacted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  QUALIFIED: { label: "Qualified", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  PROPOSAL: { label: "Proposal", className: "bg-purple-100 text-purple-700 border-purple-200" },
  NEGOTIATION: { label: "Negotiation", className: "bg-orange-100 text-orange-700 border-orange-200" },
  WON: { label: "Won", className: "bg-green-100 text-green-700 border-green-200" },
  LOST: { label: "Lost", className: "bg-red-100 text-red-700 border-red-200" },
};

// Forward funnel — used by the stepper and the "Create Proposal" gate (>= QUALIFIED).
// NEGOTIATION removed: WON/LOST are terminal actions, not steps.
export const STAGE_ORDER: LeadStage[] = [
  "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON",
];
// Stages shown in the legacy dropdown / filter chips (includes terminal states).
export const ALL_STAGES: LeadStage[] = [
  "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST",
];
export const stageRank = (s: LeadStage | null | undefined) =>
  s ? STAGE_ORDER.indexOf(s) : -1;

export const SOURCE_META: Record<LeadSourceType, { label: string; icon: typeof Phone }> = {
  EVENT: { label: "Event", icon: CalendarDays },
  REFERRAL: { label: "Referral", icon: Users },
  PHONE: { label: "Phone", icon: Phone },
  EMAIL: { label: "Email", icon: Mail },
  WEBSITE: { label: "Website", icon: Globe },
  GOOGLE: { label: "Google", icon: Search },
  COLD: { label: "Cold", icon: Snowflake },
  OTHER: { label: "Other", icon: MoreHorizontal },
};

export const TIMELINE_LABELS: Record<LeadTimeline, string> = {
  IMMEDIATE: "Immediate",
  MONTHS_1_3: "1-3 months",
  MONTHS_3_6: "3-6 months",
  MONTHS_6_PLUS: "6-12 months",
  PLANNING: "Planning",
  UNKNOWN: "Unknown",
};

export function profileLabel(p?: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "Unassigned";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
}

export function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
