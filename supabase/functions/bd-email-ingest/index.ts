import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-beacon-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GLE_COMPANY_ID =
  Deno.env.get("GLE_COMPANY_ID") ?? "01993413-d3e8-4377-9e21-70f270f04487";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  // Shared-secret auth (same secret beacon-data-proxy uses)
  const expectedKey = Deno.env.get("BEACON_ANALYTICS_KEY") ?? "";
  const providedKey = req.headers.get("x-beacon-key") ?? "";
  if (!expectedKey || providedKey !== expectedKey) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const signal_type = String(payload?.signal_type ?? "").trim();
  const title = String(payload?.title ?? "").trim();
  const summary =
    payload?.summary != null ? String(payload.summary) : null;
  const sender = payload?.sender != null ? String(payload.sender) : null;
  const sourceUrl =
    payload?.source_url != null ? String(payload.source_url) : null;
  const rawDate = payload?.date != null ? String(payload.date).trim() : "";
  const date = rawDate ? rawDate.slice(0, 10) : null;

  if (!title) return json({ ok: false, error: "title required" }, 400);
  if (signal_type !== "event" && signal_type !== "market_news") {
    return json({ ok: false, error: "invalid signal_type" }, 400);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const companyId = GLE_COMPANY_ID;

  try {
    if (signal_type === "event") {
      // Idempotency: same company + title + start_date
      const dupQ = sb
        .from("bd_events")
        .select("id")
        .eq("company_id", companyId)
        .eq("name", title)
        .limit(1);
      const { data: dup } = date
        ? await dupQ.eq("start_date", date)
        : await dupQ.is("start_date", null);

      if (dup && dup.length > 0) {
        return json({ ok: true, routed: "bd_events", deduped: true, id: dup[0].id });
      }

      const { data, error } = await sb
        .from("bd_events")
        .insert({
          company_id: companyId,
          name: title,
          notes: summary,
          category: "Email",
          status: "PENDING_APPROVAL",
          start_date: date,
          source_url: sourceUrl,
        })
        .select("id")
        .single();
      if (error) throw error;
      return json({ ok: true, routed: "bd_events", id: data.id });
    }

    // market_news
    const dupQ = sb
      .from("bd_market_signals")
      .select("id")
      .eq("company_id", companyId)
      .eq("title", title)
      .limit(1);
    const { data: dup } = date
      ? await dupQ.eq("signal_date", date)
      : await dupQ.is("signal_date", null);

    if (dup && dup.length > 0) {
      return json({
        ok: true,
        routed: "bd_market_signals",
        deduped: true,
        id: dup[0].id,
      });
    }

    const { data, error } = await sb
      .from("bd_market_signals")
      .insert({
        company_id: companyId,
        title,
        summary,
        source_url: sourceUrl,
        sender,
        signal_date: date,
        status: "NEW",
      })
      .select("id")
      .single();
    if (error) throw error;
    return json({ ok: true, routed: "bd_market_signals", id: data.id });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "Insert failed" }, 500);
  }
});
