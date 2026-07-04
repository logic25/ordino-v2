// Weekly BD event scraper cron.
// Trigger: POST with header x-cron-secret: <CRON_SECRET>
// For each active bd_event_sources row: claim (UPDATE last_checked_at=now()),
// fetch URL, ask Lovable AI to extract structured events, dedupe against
// bd_events (name+date or source_url match), insert net-new as PENDING_APPROVAL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const FETCH_TIMEOUT_MS = 10_000;
const LOVABLE_MODEL = "google/gemini-2.5-flash";
const ALLOWED_TYPES = ["CONFERENCE", "NETWORKING", "WEBINAR", "ROUNDTABLE", "AWARD_CEREMONY", "OTHER"];

type ExtractedEvent = {
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  description: string | null;
  event_type: string;
  target_audience: string | null;
  why_it_matters: string | null;
  source_url: string | null;
};

async function fetchWithTimeout(url: string, ms: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Ordino-BDScraper/1.0 (+https://ordinopm.com)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // Strip scripts/styles, collapse whitespace, cap to keep prompt small.
    const cleaned = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.slice(0, 30_000);
  } finally {
    clearTimeout(t);
  }
}

async function extractEventsWithAI(
  apiKey: string,
  sourceName: string,
  sourceUrl: string,
  text: string,
): Promise<ExtractedEvent[]> {
  const prompt = `Source: ${sourceName} (${sourceUrl})

Extract upcoming events from the content below. Return ONLY a JSON array (no prose, no code fences) of objects with these exact fields:
- title (string, required)
- start_date (ISO date YYYY-MM-DD, required; skip events without a clear date)
- end_date (ISO date YYYY-MM-DD or null)
- location (string or null)
- description (string or null, max 500 chars)
- event_type (one of: CONFERENCE, NETWORKING, WEBINAR, ROUNDTABLE, AWARD_CEREMONY, OTHER)
- target_audience (string or null — who attends, e.g. "NYC GCs and developers")
- why_it_matters (string or null — one sentence why a NYC construction expediting firm should attend)
- source_url (string or null — canonical URL of the specific event page if you can find it; otherwise the source URL)

If no events are found, return []. Today is ${new Date().toISOString().slice(0, 10)}; only include events on or after today.

CONTENT:
${text}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LOVABLE_MODEL,
      messages: [
        { role: "system", content: "You extract structured event data and return strict JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  let content: string = json?.choices?.[0]?.message?.content ?? "";
  content = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Find first '[' to be defensive
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(content.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e: any) =>
      e && typeof e.title === "string" && typeof e.start_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.start_date)
    ).map((e: any) => ({
      title: String(e.title).slice(0, 300),
      start_date: e.start_date,
      end_date: typeof e.end_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.end_date) ? e.end_date : null,
      location: e.location ? String(e.location).slice(0, 300) : null,
      description: e.description ? String(e.description).slice(0, 500) : null,
      event_type: ALLOWED_TYPES.includes(e.event_type) ? e.event_type : "OTHER",
      target_audience: e.target_audience ? String(e.target_audience).slice(0, 300) : null,
      why_it_matters: e.why_it_matters ? String(e.why_it_matters).slice(0, 500) : null,
      source_url: typeof e.source_url === "string" ? e.source_url : null,
    }));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Auth: x-cron-secret — same Vault-backed secret pg_cron uses.
  const caller = req.headers.get("x-cron-secret") || "";
  let expected = "";
  try {
    const { data } = await admin.rpc("internal_get_cron_secret");
    expected = (data as string) || "";
  } catch (e) {
    console.error("get cron secret failed:", (e as Error).message);
  }
  if (!expected || caller !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: sources, error: srcErr } = await admin
    .from("bd_event_sources")
    .select("id, company_id, name, url, is_active")
    .eq("is_active", true);

  if (srcErr) {
    return new Response(JSON.stringify({ error: srcErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = {
    sources_processed: 0,
    events_found: 0,
    events_inserted: 0,
    events_skipped: 0,
    errors: [] as Array<{ source_id: string; source_name: string; error: string }>,
  };

  for (const src of sources ?? []) {
    summary.sources_processed++;
    // Claim: stamp last_checked_at so a concurrent run skips this source.
    await admin
      .from("bd_event_sources")
      .update({ last_checked_at: new Date().toISOString(), last_scrape_error: null })
      .eq("id", src.id);

    let extracted: ExtractedEvent[] = [];
    try {
      const html = await fetchWithTimeout(src.url, FETCH_TIMEOUT_MS);
      extracted = await extractEventsWithAI(lovableKey, src.name, src.url, html);
    } catch (e) {
      const msg = (e as Error).message || String(e);
      console.error(`source ${src.name} (${src.id}) failed:`, msg);
      summary.errors.push({ source_id: src.id, source_name: src.name, error: msg });
      await admin
        .from("bd_event_sources")
        .update({ last_scrape_error: msg.slice(0, 500), last_scrape_events_found: 0 })
        .eq("id", src.id);
      continue;
    }

    summary.events_found += extracted.length;
    let insertedForSource = 0;

    for (const ev of extracted) {
      const canonicalUrl = ev.source_url || src.url;

      // Dedupe: same name+start_date OR same source_url in intel/top-level.
      const { data: dupByName } = await admin
        .from("bd_events")
        .select("id")
        .eq("company_id", src.company_id)
        .ilike("name", ev.title)
        .eq("start_date", ev.start_date)
        .limit(1);

      let isDup = (dupByName?.length ?? 0) > 0;

      if (!isDup && canonicalUrl) {
        const { data: dupByUrl } = await admin
          .from("bd_events")
          .select("id")
          .eq("company_id", src.company_id)
          .eq("source_url", canonicalUrl)
          .limit(1);
        isDup = (dupByUrl?.length ?? 0) > 0;
      }

      if (isDup) {
        summary.events_skipped++;
        continue;
      }

      const { error: insErr } = await admin.from("bd_events").insert({
        company_id: src.company_id,
        name: ev.title,
        start_date: ev.start_date,
        end_date: ev.end_date,
        location: ev.location,
        notes: ev.description,
        event_type: ev.event_type,
        target_audience: ev.target_audience,
        why_it_matters: ev.why_it_matters,
        source_url: canonicalUrl,
        status: "PENDING_APPROVAL",
        intel: {
          source_url: canonicalUrl,
          source_id: src.id,
          source_name: src.name,
          scraped_at: new Date().toISOString(),
          ai_extracted: true,
        },
      });

      if (insErr) {
        console.error(`insert failed for "${ev.title}":`, insErr.message);
        summary.errors.push({ source_id: src.id, source_name: src.name, error: `insert: ${insErr.message}` });
      } else {
        summary.events_inserted++;
        insertedForSource++;
      }
    }

    await admin
      .from("bd_event_sources")
      .update({ last_scrape_events_found: extracted.length })
      .eq("id", src.id);
  }

  return new Response(JSON.stringify(summary), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
