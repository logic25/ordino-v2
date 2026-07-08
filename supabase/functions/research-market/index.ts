// research-market: AI-drafts expansion intel for a target market.
// JWT-auth (any signed-in user). Mirrors draft-event-strategy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { market_name?: string; state?: string; tier?: number };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const name = (body.market_name ?? "").trim();
  const state = (body.state ?? "NY").trim();
  const tier = Number(body.tier);
  if (!name) return json({ error: "market_name required" }, 400);
  if (![1, 2, 3].includes(tier)) return json({ error: "tier must be 1, 2, or 3" }, 400);

  const tierContext = tier === 1
    ? "Tier 1 (NYC-adjacent — immediate expansion, similar to NYC DOB)"
    : tier === 2
    ? "Tier 2 (broader NY/NJ — moderate ramp-up)"
    : "Tier 3 (out-of-state — requires licensure or partner)";

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant for Green Light Expediting (GLE), a NYC construction permit " +
            "expediting firm (DOB filings PW1/PW2/PW3, TR1/TR8, objection resolution, COs). GLE is " +
            "evaluating expansion into a new market. Be concrete and reference real agencies, real " +
            "code differences from NYC DOB, and real competitor types. Include real dollar figures / " +
            "fee formulas where you're confident (cite the fee schedule name/URL); if you are not sure " +
            "of a specific number, say so plainly and point to where GLE should verify — do not invent specifics.",
        },
        {
          role: "user",
          content:
            `Research the expansion target: ${name}, ${state} (${tierContext}). ` +
            `Return a concise intel briefing focused on what GLE needs to know to operate there, ` +
            `INCLUDING (a) the local permit fee structure so GLE can price its expediting services on top, ` +
            `and (b) the concrete steps GLE must take to start doing work in this jurisdiction.`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "market_intel",
          description: "Expansion intel for a new GLE market.",
          parameters: {
            type: "object",
            properties: {
              why_it_matters: {
                type: "string",
                description: "2-3 sentences on market opportunity for GLE specifically (volume, owner concentration, regulatory complexity that favors expediters).",
              },
              requirements: {
                type: "string",
                description: "Key licensing, filing, or regulatory differences vs NYC DOB. Mention agency name(s) and what credentials are needed.",
              },
              key_contacts: {
                type: "string",
                description: "Relevant agencies, building departments, or industry bodies in this market (real names).",
              },
              competitive_landscape: {
                type: "string",
                description: "Who else does expediting/permit work there — firm types, notable names if known, and how GLE could differentiate.",
              },
              fee_structure: {
                type: "string",
                description: "1-2 sentence narrative summary of how permit fees work in this jurisdiction (flat vs valuation-based, who charges what). Individual GLE service pricing goes in suggested_services[] — do NOT put price ranges here. If specific numbers aren't verifiable, say so and link to the official fee schedule.",
              },
              suggested_services: {
                type: "array",
                description: "Concrete GLE service lines this market supports, with price ranges. Return 6-12 rows spanning Building, Trade, and Site categories. Every row MUST include a source_url OR set confidence='low'. Do not invent numbers — if unsure, use a wide range and confidence='low'.",
                items: {
                  type: "object",
                  properties: {
                    service_name: { type: "string", description: "e.g. 'Commercial Alteration / Tenant Fit-out', 'Electrical Permit Coordination'" },
                    category: { type: "string", enum: ["Building", "Trade", "Site / Land Development"] },
                    price_low: { type: "number", description: "Low end of GLE's suggested fee, in USD. Omit if pct-based." },
                    price_typical: { type: "number", description: "Typical GLE fee in USD. Omit if pct-based." },
                    price_high: { type: "number", description: "High end in USD. Omit if pct-based." },
                    unit: { type: "string", enum: ["per_filing", "per_hour", "pct_of_construction_cost", "pct_of_permit_fee", "flat"] },
                    basis_notes: { type: "string", description: "Why this range — e.g. 'Based on 65% plan review + coordination' or 'Valuation-based county fee, GLE ~15% markup'. 1 sentence." },
                    county_fee_note: { type: "string", description: "What the jurisdiction charges the client on top (short — e.g. 'Min $150 + $0.005/sq ft'). Empty string if unknown." },
                    confidence: { type: "string", enum: ["low", "medium", "high"] },
                    source_url: { type: "string", description: "Official fee schedule / rate card URL. Empty string only if confidence='low'." },
                  },
                  required: ["service_name", "category", "unit", "basis_notes", "confidence"],
                },
              },
              entry_steps: {
                type: "array",
                description: "Ordered, concrete steps GLE must take to legally do work in this jurisdiction. 4-10 items. Each step is a single action (register as foreign LLC, obtain business license, create e-permit portal account, etc.).",
                items: {
                  type: "object",
                  properties: {
                    step: { type: "string", description: "Short action title, e.g. 'Register as foreign LLC with NY Dept of State'." },
                    detail: { type: "string", description: "1-2 sentences on what's involved, cost, and lead time." },
                    source_url: { type: "string", description: "Official page URL if applicable. Empty string OK." },
                  },
                  required: ["step"],
                },
              },
              reference_links: {
                type: "string",
                description: "Bullet list of official URLs (fee schedule, permit portal, licensing page, review metrics) GLE staff should bookmark. Real URLs only.",
              },
              third_party_review_allowed: {
                type: "string",
                enum: ["accepted", "accepted_with_restrictions", "not_offered", "unknown"],
                description:
                  "Does this jurisdiction ALLOW third-party / peer plan review (a licensed outside reviewer approving plans in lieu of the AHJ)? " +
                  "'accepted' = named program with no material limits (must cite official URL in third_party_review_source_url). " +
                  "'accepted_with_restrictions' = allowed only for certain filing types, occupancies, project sizes, or from an approved-reviewer list (must cite URL and state the restriction in notes). " +
                  "'not_offered' = you found explicit evidence the AHJ does its own review only. " +
                  "'unknown' = you could not verify a program page. Default to 'unknown' if you cannot cite a real source URL.",
              },
              third_party_review_notes: {
                type: "string",
                description: "1-3 sentences on the third-party plan review program: program name, what filing types it covers, any approved-reviewer list, restrictions. Empty string if not offered or unknown.",
              },
              third_party_review_source_url: {
                type: "string",
                description: "Single official URL for the third-party / peer / expedited plan review program page. REQUIRED (non-empty, real https URL) for 'accepted' or 'accepted_with_restrictions'. Empty string if not_offered or unknown.",
              },
            },
            required: ["why_it_matters", "requirements", "key_contacts", "competitive_landscape", "fee_structure", "suggested_services", "entry_steps", "third_party_review_allowed"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "market_intel" } },
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text().catch(() => "");
    console.error("gateway", aiRes.status, txt.slice(0, 300));
    if (aiRes.status === 429) return json({ error: "Rate limited — try again in a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
    return json({ error: "Could not research market" }, 400);
  }

  const aiJson = await aiRes.json();
  const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  const rawArgs = call?.function?.arguments ?? "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    // Resilience pattern: never crash — return raw + warning.
    return json({
      warning: "AI response could not be parsed as JSON; raw output preserved.",
      raw: typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs),
    });
  }

  const VALID = ["accepted", "accepted_with_restrictions", "not_offered", "unknown"] as const;
  const rawTpr = ((parsed.third_party_review_allowed as string) ?? "unknown").toLowerCase().trim();
  const url = ((parsed.third_party_review_source_url as string) ?? "").trim();
  const hasRealUrl = /^https?:\/\/\S+\.\S+/i.test(url);

  // Guardrails:
  // 1. Any 'accepted*' state MUST cite a real source URL — else downgrade to 'unknown'.
  // 2. Preserve the distinction between 'not_offered' (confirmed no) and 'unknown' (couldn't verify).
  let tpr: string = VALID.includes(rawTpr as any) ? rawTpr : "unknown";
  if ((tpr === "accepted" || tpr === "accepted_with_restrictions") && !hasRealUrl) {
    tpr = "unknown";
  }

  // Normalize suggested_services[] — enforce source_url OR confidence='low'
  const rawServices = Array.isArray(parsed.suggested_services) ? parsed.suggested_services : [];
  const suggested_services = rawServices
    .filter((s: any) => s && typeof s.service_name === "string" && s.service_name.trim())
    .map((s: any) => {
      const src = typeof s.source_url === "string" ? s.source_url.trim() : "";
      const hasSrc = /^https?:\/\/\S+\.\S+/i.test(src);
      const conf = ["low", "medium", "high"].includes(s.confidence) ? s.confidence : "low";
      return {
        service_name: String(s.service_name).trim(),
        category: ["Building", "Trade", "Site / Land Development"].includes(s.category) ? s.category : "Building",
        price_low: typeof s.price_low === "number" ? s.price_low : null,
        price_typical: typeof s.price_typical === "number" ? s.price_typical : null,
        price_high: typeof s.price_high === "number" ? s.price_high : null,
        unit: typeof s.unit === "string" ? s.unit : "flat",
        basis_notes: typeof s.basis_notes === "string" ? s.basis_notes : "",
        county_fee_note: typeof s.county_fee_note === "string" ? s.county_fee_note : "",
        // Downgrade confidence when no source cited — matches the third-party guardrail pattern.
        confidence: hasSrc ? conf : "low",
        source_url: hasSrc ? src : "",
      };
    });

  const rawSteps = Array.isArray(parsed.entry_steps) ? parsed.entry_steps : [];
  const entry_steps = rawSteps
    .filter((s: any) => s && typeof s.step === "string" && s.step.trim())
    .map((s: any) => {
      const src = typeof s.source_url === "string" ? s.source_url.trim() : "";
      return {
        step: String(s.step).trim(),
        detail: typeof s.detail === "string" ? s.detail : "",
        source_url: /^https?:\/\/\S+\.\S+/i.test(src) ? src : "",
      };
    });

  return json({
    why_it_matters: (parsed.why_it_matters as string) ?? "",
    requirements: (parsed.requirements as string) ?? "",
    key_contacts: (parsed.key_contacts as string) ?? "",
    competitive_landscape: (parsed.competitive_landscape as string) ?? "",
    fee_structure: (parsed.fee_structure as string) ?? "",
    suggested_services,
    entry_steps,
    reference_links: (parsed.reference_links as string) ?? "",
    third_party_review_allowed: tpr,
    third_party_review_notes: (parsed.third_party_review_notes as string) ?? "",
    third_party_review_source_url: hasRealUrl ? url : "",
  });
});
