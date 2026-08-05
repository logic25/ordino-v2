import { supabase } from "@/integrations/supabase/client";

export interface SignalLeadProperty {
  owner?: string | null;
  incumbent_expediter?: string | null;
  gle_filings_here?: number | string | null;
}

export interface SignalLead {
  party: string;
  address?: string | null;
  deal_type?: string | null;
  angle?: string | null;
  property?: SignalLeadProperty | null;
  who_we_know?: string[] | null;
}

export interface EnrichSignalResponse {
  lead_count: number;
  leads: SignalLead[];
}

/** Extract structured leads from a market-signal blurb via Beacon (key stays server-side). */
export async function enrichSignal(text: string): Promise<EnrichSignalResponse> {
  const { data, error } = await supabase.functions.invoke("enrich-signal", {
    body: { text },
  });
  if (error) throw new Error(`Signal enrichment error: ${error.message}`);
  const leads = Array.isArray((data as any)?.leads) ? ((data as any).leads as SignalLead[]) : [];
  return { lead_count: (data as any)?.lead_count ?? leads.length, leads };
}

/** Build the notes body for a lead extracted from a signal. */
export function buildSignalLeadNotes(lead: SignalLead, signalSummary?: string | null): string {
  const lines: string[] = [];
  if (lead.deal_type) lines.push(`Deal type: ${lead.deal_type}`);
  if (lead.angle) lines.push(`Angle: ${lead.angle}`);
  const p = lead.property;
  if (p) {
    if (p.owner) lines.push(`Owner: ${p.owner}`);
    if (p.incumbent_expediter) lines.push(`Incumbent expediter: ${p.incumbent_expediter}`);
    if (p.gle_filings_here != null && p.gle_filings_here !== "")
      lines.push(`GLE filings at this property: ${p.gle_filings_here}`);
  }
  if (lead.who_we_know && lead.who_we_know.length > 0)
    lines.push(`Who we know: ${lead.who_we_know.join(", ")}`);
  if (signalSummary) lines.push("", "— Signal —", signalSummary);
  return lines.join("\n");
}
