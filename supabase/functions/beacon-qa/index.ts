// Beacon Project Q&A v1 — tool-calling loop over an allowlisted slice of the schema.
// JWT-authenticated. Calls Lovable AI Gateway. Logs every tool call to beacon_tool_log.
//
// NOTE on model: the sprint plan specified anthropic/claude-haiku-4-5 but Lovable AI Gateway
// only exposes google/* and openai/*. Substituting openai/gpt-5-mini, which is the strongest
// tool-caller available on the gateway. Easy to swap later if Anthropic ships there.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { TOOL_DEFINITIONS, SYSTEM_PROMPT } from "./manifest.ts";
import { TOOL_REGISTRY, type Ctx } from "./tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TOOL_CALLS = 8;
const HARD_TIMEOUT_MS = 30_000;
const MAX_INPUT_TOKENS = 50_000;
const MODEL = "openai/gpt-5-mini";

function corsJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return corsJson({ error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return corsJson({ error: "LOVABLE_API_KEY not configured" }, 500);

  // ---- Auth: derive user + company from JWT
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace("Bearer ", "");
  if (!bearer) return corsJson({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser(bearer);
  if (userErr || !user) return corsJson({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: prof } = await admin
    .from("profiles")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const companyId = prof?.company_id;
  if (!companyId) return corsJson({ error: "No company for user" }, 403);

  // ---- Body
  let body: { question?: string; question_id?: string; project_id?: string };
  try { body = await req.json(); } catch { return corsJson({ error: "Invalid JSON" }, 400); }
  const question = (body.question ?? "").trim();
  if (!question) return corsJson({ error: "question required" }, 400);
  const questionId = body.question_id ?? crypto.randomUUID();

  const ctx: Ctx = { supabase: admin, companyId };

  // ---- Audit log helper (fire-and-forget)
  function logTool(name: string, params: any, result: { ok: boolean; rowCount?: number; err?: string; ms: number }) {
    admin.from("beacon_tool_log").insert({
      user_id: user.id,
      company_id: companyId,
      project_id: params?.project_id ?? body.project_id ?? null,
      question_id: questionId,
      question_text: question,
      tool_name: name,
      parameters: params,
      row_count: result.rowCount ?? null,
      duration_ms: result.ms,
      success: result.ok,
      error_message: result.err ?? null,
    }).then(() => {}).catch(() => {});
  }

  // ---- Tool-calling loop
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question + (body.project_id ? `\n\n(active project_id: ${body.project_id})` : "") },
  ];

  let toolCallsRemaining = MAX_TOOL_CALLS;
  let truncatedDueToBudget = false;
  let lastAssistant: any = null;

  while (toolCallsRemaining > 0) {
    if (Date.now() - startedAt > HARD_TIMEOUT_MS) {
      truncatedDueToBudget = true;
      break;
    }

    // Rough token guard
    const approxTokens = JSON.stringify(messages).length / 4;
    if (approxTokens > MAX_INPUT_TOKENS) {
      truncatedDueToBudget = true;
      break;
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
      }),
      signal: AbortSignal.timeout(HARD_TIMEOUT_MS - (Date.now() - startedAt)),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text().catch(() => "");
      if (aiRes.status === 429) return corsJson({ error: "Rate limited, try again shortly." }, 429);
      if (aiRes.status === 402) return corsJson({ error: "AI credits exhausted." }, 402);
      console.error("ai gateway", aiRes.status, txt);
      return corsJson({ error: `AI gateway error ${aiRes.status}` }, 500);
    }

    const aiJson = await aiRes.json();
    const msg = aiJson?.choices?.[0]?.message;
    if (!msg) return corsJson({ error: "Empty AI response" }, 500);
    lastAssistant = msg;
    messages.push(msg);

    const toolCalls = msg.tool_calls ?? [];
    if (!toolCalls.length) break; // assistant produced final text

    for (const call of toolCalls) {
      toolCallsRemaining -= 1;
      const name: string = call.function?.name;
      let parsedArgs: any = {};
      try { parsedArgs = JSON.parse(call.function?.arguments || "{}"); } catch {}

      const exec = TOOL_REGISTRY[name];
      const toolStart = Date.now();
      if (!exec) {
        const err = `unknown_tool:${name}`;
        logTool(name, parsedArgs, { ok: false, err, ms: Date.now() - toolStart });
        messages.push({
          role: "tool", tool_call_id: call.id,
          content: JSON.stringify({ error: err }),
        });
        continue;
      }

      try {
        const result = await exec(ctx, parsedArgs);
        const rowCount = Array.isArray(result?.rows)
          ? result.rows.length
          : typeof result?.count === "number" ? result.count : null;
        logTool(name, parsedArgs, { ok: true, rowCount: rowCount ?? undefined, ms: Date.now() - toolStart });
        messages.push({
          role: "tool", tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        logTool(name, parsedArgs, { ok: false, err: errMsg, ms: Date.now() - toolStart });
        messages.push({
          role: "tool", tool_call_id: call.id,
          content: JSON.stringify({ error: errMsg }),
        });
      }

      if (toolCallsRemaining <= 0) break;
    }
  }

  // If we exited the loop after tool calls without a clean text response,
  // ask the model one final time for a natural-language summary.
  if (truncatedDueToBudget || (lastAssistant?.tool_calls?.length && !lastAssistant?.content)) {
    messages.push({
      role: "system",
      content: truncatedDueToBudget
        ? "You hit your exploration budget. Summarize what you found and tell the user to narrow the question if needed."
        : "Summarize what you found in plain English. Be concise.",
    });
    try {
      const finalRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages }),
        signal: AbortSignal.timeout(15_000),
      });
      const finalJson = await finalRes.json();
      lastAssistant = finalJson?.choices?.[0]?.message ?? lastAssistant;
    } catch (e) {
      console.error("final summarize failed", e);
    }
  }

  const answer = lastAssistant?.content || "I couldn't find an answer to that.";
  return corsJson({
    answer,
    question_id: questionId,
    duration_ms: Date.now() - startedAt,
    truncated: truncatedDueToBudget,
  });
});
