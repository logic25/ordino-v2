import { supabase } from "@/integrations/supabase/client";

export interface SignalLeadProperty {
  owner?: string | null;
  incumbent?: string | null;
  incumbent_expediter?: string | null;
  gle_gap?: string | null;
  gle_filings_here?: number | string | null;
}

export interface SignalLead {
  party: string;
  address?: string | null;
  deal_type?: string | null;
  angle?: string | null;
  why?: string | null;
  property?: SignalLeadProperty | null;
  who_we_know?: string[] | Record<string, unknown> | string | null;
}

export interface EnrichSignalResponse {
  lead_count: number;
  leads: SignalLead[];
  story?: string;
}

/** Extract structured leads from a market-signal blurb via Beacon (key stays server-side). */
export async function enrichSignal(text: string): Promise<EnrichSignalResponse> {
  const { data, error } = await supabase.functions.invoke("enrich-signal", {
    body: { text },
  });
  if (error) throw new Error(`Signal enrichment error: ${error.message}`);
  const leads = Array.isArray((data as any)?.leads) ? ((data as any).leads as SignalLead[]) : [];
  return {
    lead_count: (data as any)?.lead_count ?? leads.length,
    leads,
    story: typeof (data as any)?.story === "string" ? (data as any).story : "",
  };
}

/** Normalize the varied shapes Beacon returns for who_we_know into display lines. */
export function whoWeKnowLines(value: SignalLead["who_we_know"]): string[] {
  if (!value) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .filter((v) => v && v.trim());
  }
  return Object.entries(value)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
}

export function incumbentOf(lead: SignalLead): string | null {
  return lead.property?.incumbent || lead.property?.incumbent_expediter || null;
}

export function gleGapOf(lead: SignalLead): string | null {
  const p = lead.property;
  if (!p) return null;
  if (p.gle_gap) return String(p.gle_gap);
  if (p.gle_filings_here != null && p.gle_filings_here !== "")
    return `${p.gle_filings_here} GLE filings at this property`;
  return null;
}

/** Build the notes body for a lead extracted from a signal. */
export function buildSignalLeadNotes(lead: SignalLead, signalSummary?: string | null): string {
  const lines: string[] = [];
  if (lead.deal_type) lines.push(`Deal type: ${lead.deal_type}`);
  if (lead.angle) lines.push(`Angle: ${lead.angle}`);
  if (lead.property?.owner) lines.push(`Owner: ${lead.property.owner}`);
  const incumbent = incumbentOf(lead);
  if (incumbent) lines.push(`Incumbent expediter: ${incumbent}`);
  const gap = gleGapOf(lead);
  if (gap) lines.push(`GLE gap: ${gap}`);
  const who = whoWeKnowLines(lead.who_we_know);
  if (who.length > 0) lines.push(`Who we know: ${who.join("; ")}`);
  if (signalSummary) lines.push("", "— Signal —", signalSummary);
  return lines.join("\n");
}
