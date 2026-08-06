import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENERIC_SYSTEM_PROMPT = `You are a knowledgeable AI assistant answering a question about NYC Department of Buildings filings and construction expediting.

IMPORTANT: You have NO access to Green Light Expediting's internal knowledge base, SOPs, filing guides, or past project history. Answer only from your general knowledge of publicly available information. If you are unsure or the answer depends on internal firm procedure or current agency practice you cannot verify, say so plainly rather than guessing.

Be concise and direct. Do not invent citations, document names, or bulletin numbers.`;

/** Concrete, checkable specifics: DOB forms, code sections, dollar figures, timelines. */
const SPECIFIC_PATTERNS: RegExp[] = [
  /\b(PW[1-9]|TR[1-8]|AI-?1|AI1|LAA|ALT-?[123]|NB|PAA|OP-?38|CCD1|EWN)\b/gi,
  /(?:§|section\s+)\s?\d+[\w.\-–]*/gi,
  /\bAC\s?\d{2}-\d+(?:\.\d+)*/gi,
  /\b(?:1\s?RCNY|BC|ZR)\s?\d+[\w.\-–]*/gi,
  /\$\s?\d[\d,.]*/g,
  /\b\d+\s?(?:business\s+)?(?:day|days|week|weeks|month|months)\b/gi,
];

function extractSpecifics(text: string): string[] {
  const found = new Set<string>();
  for (const re of SPECIFIC_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const v = m[0].trim().replace(/\s+/g, " ");
      if (v) found.add(v.toLowerCase());
    }
  }
  return Array.from(found);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Non-OpenAI models go through /v1/chat/completions. */
async function callChatCompletions(apiKey: string, model: string, question: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: GENERIC_SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(text || `Gateway error ${res.status}`), { status: res.status });
  }
  let out = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload);
        out += chunk.choices?.[0]?.delta?.content ?? "";
      } catch {
        // partial JSON — ignored, next chunk completes it
      }
    }
  }
  return out;
}

/** OpenAI models are served by the gateway Responses API; always streamed. */
async function callResponsesApi(apiKey: string, model: string, question: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      stream: true,
      instructions: GENERIC_SYSTEM_PROMPT,
      input: question,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(text || `Gateway error ${res.status}`), { status: res.status });
  }
  let out = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          out += evt.delta;
        } else if (evt.type === "response.completed" && !out) {
          out = evt.response?.output_text ?? "";
        }
      } catch {
        // partial JSON — ignored
      }
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claims?.claims) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 2000) {
      return jsonResponse({ error: "A question of 1–2000 characters is required" }, 400);
    }
    const allowedModels = ["openai/gpt-5.5", "google/gemini-2.5-pro"];
    const genericModel = allowedModels.includes(body.genericModel)
      ? body.genericModel
      : "openai/gpt-5.5";

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return jsonResponse({ error: "AI is not configured" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const beaconStart = Date.now();
    const beaconPromise = fetch(`${supabaseUrl}/functions/v1/beacon-proxy?action=chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        message: question,
        user_name: "Beacon vs LLM benchmark",
        space_id: "ordino-benchmark",
        jurisdiction: null,
      }),
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) throw Object.assign(new Error(text), { status: res.status });
      return { data: JSON.parse(text), ms: Date.now() - beaconStart };
    });

    const genericStart = Date.now();
    const genericPromise = (
      genericModel.startsWith("openai/")
        ? callResponsesApi(apiKey, genericModel, question)
        : callChatCompletions(apiKey, genericModel, question)
    ).then((answer) => ({ answer, ms: Date.now() - genericStart }));

    const [beaconResult, genericResult] = await Promise.allSettled([
      beaconPromise,
      genericPromise,
    ]);

    if (genericResult.status === "rejected") {
      const status = (genericResult.reason as { status?: number })?.status;
      if (status === 429) {
        return jsonResponse({ error: "Rate limit exceeded — try again in a moment." }, 429);
      }
      if (status === 402) {
        return jsonResponse(
          { error: "AI credits exhausted. Add credits in workspace settings." },
          402,
        );
      }
    }

    const beaconAnswer =
      beaconResult.status === "fulfilled" ? (beaconResult.value.data.response ?? "") : "";
    const beaconSources =
      beaconResult.status === "fulfilled" && Array.isArray(beaconResult.value.data.sources)
        ? beaconResult.value.data.sources
        : [];
    const genericAnswer = genericResult.status === "fulfilled" ? genericResult.value.answer : "";

    const beaconSpecifics = extractSpecifics(beaconAnswer);
    const genericSpecifics = extractSpecifics(genericAnswer);
    const genericSet = new Set(genericSpecifics);

    return jsonResponse({
      question,
      beacon: {
        answer: beaconAnswer,
        sources: beaconSources,
        confidence:
          beaconResult.status === "fulfilled" ? (beaconResult.value.data.confidence ?? null) : null,
        response_time_ms: beaconResult.status === "fulfilled" ? beaconResult.value.ms : null,
        error:
          beaconResult.status === "rejected"
            ? String((beaconResult.reason as Error)?.message ?? "Beacon request failed").slice(0, 300)
            : null,
      },
      generic: {
        answer: genericAnswer,
        model: genericModel,
        response_time_ms: genericResult.status === "fulfilled" ? genericResult.value.ms : null,
        error:
          genericResult.status === "rejected"
            ? String((genericResult.reason as Error)?.message ?? "Frontier model request failed").slice(0, 300)
            : null,
      },
      delta: {
        beaconSources: beaconSources.length,
        genericSources: 0,
        beaconSpecifics,
        genericSpecifics,
        onlyBeaconSpecifics: beaconSpecifics.filter((s) => !genericSet.has(s)),
      },
    });
  } catch (err) {
    console.error("compare-answers error:", err);
    return jsonResponse({ error: (err as Error).message ?? "Internal server error" }, 500);
  }
});
