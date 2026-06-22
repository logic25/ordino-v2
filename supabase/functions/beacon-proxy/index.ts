import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BEACON_API_URL = Deno.env.get("BEACON_API_URL") || "https://beaconrag.up.railway.app";
const BEACON_API_KEY = Deno.env.get("BEACON_ANALYTICS_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Health check doesn't require authentication
    if (action === "health") {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const beaconRes = await fetch(`${BEACON_API_URL}/`, { method: "GET", signal: controller.signal });
        clearTimeout(timeout);
        const responseBody = await beaconRes.text();
        return new Response(responseBody, {
          status: beaconRes.status,
          headers: { ...corsHeaders, "Content-Type": beaconRes.headers.get("Content-Type") || "application/json" },
        });
      } catch (e) {
        console.error("Beacon health check failed:", e);
        return new Response(
          JSON.stringify({ status: "unavailable", error: (e as Error).message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verify JWT for all other actions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ingest (KB upload + KB doc edits) is open to any AUTHENTICATED company member,
    // not just admins — PMs (e.g. Sheri) curate the knowledge base. The caller is
    // already authenticated above; we additionally require a real profile (i.e. a
    // member of a company, not a bare auth user). Accountability comes from the
    // version-history audit (kb_document_versions: who/when, with restore) rather
    // than from locking edits to admins.
    if (action === "ingest") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!prof?.company_id) {
        return new Response(JSON.stringify({ error: "Must be a company member to contribute to the knowledge base" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let beaconUrl: string;
    let beaconReqInit: RequestInit;

    if (action === "chat") {
      beaconUrl = `${BEACON_API_URL}/api/chat`;
      const body = await req.json();

      // ── Server-side identity binding (anti-spoof) ──
      // Derive company_id and user_id from the verified JWT, ignoring any client-supplied
      // values. Without this, a caller can forge `company_id` in the body and Railway will
      // scope KB retrieval + downstream beacon-data-proxy calls to the spoofed tenant.
      {
        const sbSvc = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: prof } = await sbSvc
          .from("profiles")
          .select("id, company_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!prof?.company_id) {
          return new Response(JSON.stringify({ error: "No company for user" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (body.company_id && body.company_id !== prof.company_id) {
          console.warn(`beacon-proxy/chat: company_id spoof attempt — user=${user.id} sent=${body.company_id} verified=${prof.company_id}`);
        }
        if (body.user_id && body.user_id !== user.id && body.user_id !== prof.id) {
          console.warn(`beacon-proxy/chat: user_id spoof attempt — auth=${user.id} sent=${body.user_id}`);
        }
        body.company_id = prof.company_id;
        body.user_id = user.id;
      }

      // ── Page & error context injection ──
      const projectCtx = body.project_context || {};
      const currentPage = projectCtx.currentPage || projectCtx.current_page || "";
      const recentErrors = projectCtx.recentErrors || projectCtx.recent_errors || [];

      // ── Bug Triage Sub-Agent routing ──
      const lastMessage = body.message || body.messages?.[body.messages?.length - 1]?.content || "";

      // Explicit prefix / slash command = guaranteed bug log (bypasses AI classifier).
      const explicitBugPrefix = /^\s*(\/bug\b|bug\s*[:\-]|issue\s*[:\-]|report\s+(a\s+)?bug\b)/i.test(lastMessage);
      // Cheap keyword fallback if classifier call fails.
      const keywordBugHit = /\b(bug|broken|error|crash|fail|not working|issue|wrong|stuck|breaking|doesn't work)\b/i.test(lastMessage);

      // ── AI bug classifier (Lovable AI Gateway, Gemini Flash Lite) ──
      let aiBugClassification: { is_bug: boolean; confidence: number; reason?: string } | null = null;
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
      if (LOVABLE_API_KEY && lastMessage && !explicitBugPrefix) {
        try {
          const classifierRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": LOVABLE_API_KEY,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content:
                    "You classify a single user message sent to an in-app assistant (Beacon) inside Ordino, a CRM. " +
                    "Decide if the user is reporting a software bug, defect, or broken behavior (something in the app is not working as expected, showing wrong data, missing, crashing, stuck, slow, looks wrong, etc.). " +
                    "Pure how-to questions ('how do I X', 'where do I find X'), feature requests ('can we add X'), data lookups ('how many projects'), and general chitchat are NOT bugs. " +
                    "Respond with strict JSON: {\"is_bug\": boolean, \"confidence\": number 0-1, \"reason\": short string}.",
                },
                {
                  role: "user",
                  content: `Page: ${currentPage || "Unknown"}\nRecent client errors: ${(recentErrors || []).slice(0, 3).map((e: any) => e?.message || String(e)).join(" | ") || "none"}\n\nMessage:\n${lastMessage}`,
                },
              ],
            }),
          });
          if (classifierRes.ok) {
            const cj = await classifierRes.json();
            const txt = cj?.choices?.[0]?.message?.content || "";
            try {
              const parsed = JSON.parse(txt);
              if (typeof parsed?.is_bug === "boolean") {
                aiBugClassification = {
                  is_bug: !!parsed.is_bug,
                  confidence: Number(parsed.confidence ?? 0),
                  reason: parsed.reason,
                };
              }
            } catch (e) {
              console.error("Bug classifier JSON parse failed:", e, txt?.slice(0, 200));
            }
          } else {
            console.error("Bug classifier non-OK:", classifierRes.status, (await classifierRes.text()).slice(0, 200));
          }
        } catch (e) {
          console.error("Bug classifier call failed (non-blocking):", e);
        }
      }

      const isBugQuestion =
        explicitBugPrefix ||
        (aiBugClassification ? aiBugClassification.is_bug && aiBugClassification.confidence >= 0.6 : keywordBugHit);

      // ── Data Query Pre-Fetch ──
      // Detect data questions and pre-fetch answers from beacon-data-proxy
      const isDataQuestion = /\b(how many|count|total|list|show me|what are|which|revenue|outstanding|overdue|active projects|open projects|unpaid|invoices?|proposals?|clients?|projects?|properties|workload|pipeline|forecast|recommend|suggest|know a|know any|good\s+\w+er)\b/i.test(lastMessage)
        && !isBugQuestion;

      if (isDataQuestion) {
        try {
          const dataProxyUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/beacon-data-proxy";
          const dataQueries: { action: string; params: any; label: string }[] = [];

          // Detect which data to fetch based on keywords
          const msgLower = lastMessage.toLowerCase();

          if (/project/i.test(msgLower)) {
            const statusMatch = msgLower.match(/\b(active|open|closed|on.?hold|completed|paused)\b/);
            const status = statusMatch ? statusMatch[1] : "open";
            dataQueries.push({
              action: "query_projects",
              params: { status },
              label: `${status} projects`,
            });
          }
          if (/proposal/i.test(msgLower)) {
            const statusMatch = msgLower.match(/\b(draft|sent|executed|lost|expired)\b/);
            dataQueries.push({
              action: "query_proposals",
              params: statusMatch ? { status: statusMatch[1] } : {},
              label: "proposals",
            });
          }
          if (/invoice|outstanding|overdue|unpaid|revenue|collected/i.test(msgLower)) {
            const statusMatch = msgLower.match(/\b(draft|sent|paid|overdue|void)\b/);
            dataQueries.push({
              action: "query_invoices",
              params: statusMatch ? { status: statusMatch[1] } : {},
              label: "invoices",
            });
          }
          if (/workload|pm|project manager/i.test(msgLower)) {
            dataQueries.push({
              action: "query_pm_workload",
              params: {},
              label: "PM workload",
            });
          }
          {
            const TRADE_WORDS = "plumb(?:er|ing)?|architect|engineer(?:ing)?|mep|electrician|electrical|hvac|structural|gc|general\\s*contractor|contractor|expedit(?:er|or|ing)?|surveyor|sia|consultant|landscape|fire\\s*protection|draftsman|drafter|sprinkler|elevator|abatement|asbestos|geotech|environmental|acoustic|lighting|interior\\s*designer";
            const tradeIntent = new RegExp(
              `(recommend|suggest|know\\s+(?:a|any|of\\s+a|of\\s+any)|good|got\\s+a|need\\s+a|looking\\s+for\\s+a|who\\s+(?:are|is)\\s+our|do\\s+we\\s+have|any\\s+good|list\\s+(?:our|all)|find\\s+(?:me|us))\\b.*\\b(${TRADE_WORDS})|\\b(${TRADE_WORDS})\\b.*\\b(recommend|suggest|good|reliable|responsive)`,
              "i"
            );
            if (tradeIntent.test(msgLower)) {
              const typeMatch = msgLower.match(new RegExp(`\\b(${TRADE_WORDS})\\b`, "i"));
              // Detect US state mention (full name or 2-letter code) → pass as jurisdiction
              const STATE_MAP: Record<string, string> = {
                "new york": "NY", "ny": "NY", "nyc": "NY",
                "new jersey": "NJ", "nj": "NJ", "jersey": "NJ",
                "connecticut": "CT", "ct": "CT",
                "pennsylvania": "PA", "pa": "PA",
                "massachusetts": "MA", "mass": "MA", "ma": "MA",
                "florida": "FL", "fl": "FL",
                "california": "CA", "calif": "CA", "ca": "CA",
                "texas": "TX", "tx": "TX",
              };
              // NYC boroughs imply NY licensure
              const NYC_BOROUGHS = /\b(queens|brooklyn|bronx|manhattan|staten\s*island)\b/i;
              let jurisdiction: string | undefined;
              for (const [k, v] of Object.entries(STATE_MAP)) {
                const re = new RegExp(`\\b${k.replace(/\s+/g, "\\s+")}\\b`, "i");
                if (re.test(msgLower)) { jurisdiction = v; break; }
              }
              if (!jurisdiction && NYC_BOROUGHS.test(msgLower)) jurisdiction = "NY";
              dataQueries.push({
                action: "vendor_lookup",
                params: { type: typeMatch ? typeMatch[1] : undefined, ...(jurisdiction ? { jurisdiction } : {}) },
                label: jurisdiction ? `vendor recommendations (${jurisdiction})` : "vendor recommendations",
              });
            }

          }
          if (/filing|readiness/i.test(msgLower)) {
            dataQueries.push({
              action: "check_filing_readiness",
              params: {},
              label: "filing readiness",
            });
          }

          // If no specific match, try a general projects query
          if (dataQueries.length === 0 && /how many|count|total/i.test(msgLower)) {
            dataQueries.push({
              action: "query_projects",
              params: { status: "open" },
              label: "active projects",
            });
          }

          // Execute data queries in parallel
          const dataResults = await Promise.allSettled(
            dataQueries.map(async (dq) => {
              const res = await fetch(dataProxyUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-beacon-key": BEACON_API_KEY,
                },
                body: JSON.stringify({ action: dq.action, params: dq.params }),
              });
              if (!res.ok) return { label: dq.label, error: true };
              const json = await res.json();
              return { label: dq.label, data: json.data };
            })
          );

          const dataContext: string[] = [];
          for (const r of dataResults) {
            if (r.status === "fulfilled" && r.value && !r.value.error) {
              const { label, data } = r.value;
              if (Array.isArray(data)) {
                dataContext.push(`**Live ${label} data:** ${data.length} records found.`);
                // Include summary for count questions
                dataContext.push(`Count: ${data.length}`);
                // Include first few records as sample
                if (data.length > 0) {
                  const sample = data.slice(0, 5).map((d: any) =>
                    d.name || d.project_number || d.invoice_number || d.proposal_number || d.display_name || JSON.stringify(d).slice(0, 100)
                  ).join(", ");
                  dataContext.push(`Sample: ${sample}${data.length > 5 ? ` ... and ${data.length - 5} more` : ""}`);
                }
              } else if (data && typeof data === "object") {
                // For structured results like invoices/proposals with totals
                if (data.vendors) {
                  const renderVendor = (v: any) => {
                    const parts: string[] = [`• **${v.name}**`];
                    if (v.type) parts.push(`(${v.type})`);
                    if (v.borough) parts.push(`— ${v.borough}`);
                    if (v.avg_rating) parts.push(`⭐ ${v.avg_rating}/5 (${v.review_count})`);
                    else parts.push(`no reviews yet`);
                    let line = parts.join(" ");
                    if (v.match_reasons?.length) line += `\n  Why: ${v.match_reasons.slice(0, 3).join(" · ")}`;
                    if (v.responsiveness) line += `\n  ⚡ ${v.responsiveness.bucket} (~${v.responsiveness.medianHours}h reply, ${v.responsiveness.sampleSize} threads)`;
                    if (v.past_jobs_count > 0) {
                      line += `\n  ${v.past_jobs_count} past job${v.past_jobs_count > 1 ? "s" : ""}`;
                      if (v.last_worked?.month) line += ` (last: ${v.last_worked.month}${v.last_worked.address ? " — " + v.last_worked.address : ""})`;
                    }
                    if (v.specialty_tags?.length) line += `\n  Specialties: ${v.specialty_tags.join(", ")}`;
                    if (v.licensed_jurisdictions?.length) line += `\n  Licensed in: ${v.licensed_jurisdictions.join(", ")}`;
                    else if (data.jurisdiction) line += `\n  ⚠️ Licensure in ${data.jurisdiction} not recorded — verify before assigning`;
                    if (v.matched_contacts?.length) {
                      line += `\n  People matching this trade:`;
                      for (const mc of v.matched_contacts) {
                        const jurNote = mc.licensed_jurisdictions?.length
                          ? ` [${mc.licensed_jurisdictions.join("/")}]`
                          : (data.jurisdiction ? ` [${data.jurisdiction}? unverified]` : "");
                        line += `\n    – ${mc.name}${mc.title ? ` — ${mc.title}` : ""}${mc.license ? ` (${mc.license})` : ""}${jurNote}${mc.email ? ` <${mc.email}>` : ""}${mc.phone ? ` ${mc.phone}` : ""}`;
                      }
                    } else if (v.primary_contact) {
                      line += `\n  Contact: ${v.primary_contact.name}${v.primary_contact.email ? ` <${v.primary_contact.email}>` : ""}${v.primary_contact.phone ? ` ${v.primary_contact.phone}` : ""}`;
                    }
                    if (v.recent_reviews?.length > 0 && v.recent_reviews[0].text) {
                      line += `\n  Latest review (${v.recent_reviews[0].rating}★): "${v.recent_reviews[0].text}" — ${v.recent_reviews[0].reviewer}`;
                    }
                    if (v.internal_notes) line += `\n  Internal note: ${v.internal_notes.slice(0, 160)}`;
                    return line;
                  };
                  const vendorLines = (data.vendors || []).map(renderVendor).join("\n");
                  const jurNote = data.jurisdiction
                    ? ` licensed in ${data.jurisdiction}`
                    : "";
                  let block = `**Partner recommendations from our database (${data.count} RFP partner${data.count === 1 ? "" : "s"} match${jurNote}):**\nPresent these as YOUR recommendations from the company's vetted partner list. ALWAYS state *why* each was selected (match reason, rating, past projects${data.jurisdiction ? ", jurisdiction" : ""}). Prefer high ratings, fast responsiveness, past jobs together.${data.jurisdiction ? ` When jurisdiction is requested, treat firms with explicit "Licensed in: ${data.jurisdiction}" as confirmed; flag any "unverified" notes so the user knows to confirm.` : ""}\n${vendorLines}`;
                  if (data.jurisdiction_unverified?.length) {
                    const unverifiedLines = data.jurisdiction_unverified.map(renderVendor).join("\n");
                    block += `\n\n**Possible matches — ${data.jurisdiction} licensure NOT confirmed in our records** (list these too but explicitly tell the user to verify state licensure before assigning):\n${unverifiedLines}`;
                  }
                  if (data.suggested_partners?.length) {
                    const suggestLines = data.suggested_partners.map((v: any) =>
                      `• **${v.name}** — has ${v.matched_contacts.length} matching contact${v.matched_contacts.length === 1 ? "" : "s"} (${v.matched_contacts.map((m: any) => m.name + (m.title ? ` — ${m.title}` : "")).join("; ")}) but is NOT yet flagged as an RFP partner.`
                    ).join("\n");
                    block += `\n\n**Suggested to add as RFP partners** (firms in your contacts with matching people, but not yet marked as partners — mention these to the user so they can promote them):\n${suggestLines}`;
                  }
                  dataContext.push(block);

                } else if (data.proposals) {
                  dataContext.push(`**Live ${label} data:** ${data.proposals.length} proposals. Total pipeline: $${(data.total_pipeline_value || 0).toLocaleString()}`);
                } else if (data.invoices) {
                  dataContext.push(`**Live ${label} data:** ${data.invoices.length} invoices. Outstanding: $${(data.outstanding_total || 0).toLocaleString()}. Paid: $${(data.paid_total || 0).toLocaleString()}`);
                } else {
                  dataContext.push(`**Live ${label} data:** ${JSON.stringify(data).slice(0, 500)}`);
                }
              }
            }
          }

          if (dataContext.length > 0) {
            const strictPreamble = `\n\n**LIVE DATABASE RESULTS — AUTHORITATIVE. Use ONLY the entities listed below to answer. Do NOT list any person or firm not appearing here, even if you remember them from prior context or retrieved documents. If the list is empty, say so plainly — do NOT fall back to free-text recall of contacts.**\n`;
            body.system_context = (body.system_context || "") + strictPreamble + dataContext.join("\n");
            // Also append a short note to the user message itself so the chat LLM can't ignore the system_context
            body.message = (body.message || "") +
              `\n\n[Internal: Answer ONLY from the LIVE DATABASE RESULTS block in system context. Do not invent or recall other names.]`;
            console.log("Injected data context for query:", dataQueries.map(d => d.label).join(", "));
          }
        } catch (e) {
          console.error("Data query pre-fetch failed (non-blocking):", e);
        }
      }

      if (isBugQuestion) {
        // Inject bug detection instruction directly into message so LLM always sees it
        body.message = body.message + `\n\n[SYSTEM INSTRUCTION: If the user is reporting a genuine software bug, error, or broken feature, you MUST include the exact marker <!--BUG_REPORT--> at the very end of your response. Only include this for actual bugs/errors, NOT for general questions or how-to queries.]`;

        body.system_context = (body.system_context || "") +
          `\n\n**Bug Detection:** If the user is reporting a genuine software bug, error, or broken feature, include the exact marker \`<!--BUG_REPORT-->\` at the very end of your response.`;

        try {
          const dataProxyUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/beacon-data-proxy";
          const patternRes = await fetch(dataProxyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-beacon-key": BEACON_API_KEY,
            },
            body: JSON.stringify({
              action: "query_bug_patterns",
              params: { search: lastMessage, limit: 5 },
            }),
          });

          if (patternRes.ok) {
            const patternData = await patternRes.json();
            const patterns = patternData?.data?.patterns || [];
            if (patterns.length > 0) {
              const patternContext = patterns.map((p: any) =>
                `• "${p.pattern_name}" (seen ${p.occurrences}x): Root cause: ${p.root_cause || "unknown"}. Fix: ${p.fix_pattern || "N/A"}. Files: ${(p.affected_files || []).join(", ")}`
              ).join("\n");

              body.system_context = (body.system_context || "") +
                `\n\n**Known Bug Patterns (institutional knowledge):**\n${patternContext}\n\nUse these patterns to inform your answer. If a pattern matches the user's question, cite it specifically ("I've seen this pattern X times before...").`;
            }
          }
        } catch (e) {
          console.error("Bug pattern lookup failed (non-blocking):", e);
        }
      }

      // Forward the end-user's Supabase JWT + company_id + jurisdiction to Railway /api/chat
      // so Railway can (eventually) forward the JWT to beacon-data-proxy for per-user company scoping.
      // company_id and user_id are JWT-derived server-side above (anti-spoof); any client-supplied
      // values were overwritten. jurisdiction stays client-supplied (intentionally null until KB
      // docs are tagged in Pinecone AND Railway's jurisdiction handling ships).
      beaconReqInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
          // Forward end-user JWT (planned: Railway → beacon-data-proxy hop)
          ...(authHeader ? { "x-ordino-user-authorization": authHeader } : {}),
        },
        body: JSON.stringify(body),
      };

      // Send to Beacon, then parse response for bug flag
      const beaconRes = await fetch(beaconUrl, beaconReqInit);
      const responseText = await beaconRes.text();

      try {
        const responseJson = JSON.parse(responseText);
        // Check for bug marker in the response text
        const hasBugMarker = (responseJson.response || "").includes("<!--BUG_REPORT-->");
        if (hasBugMarker) {
          responseJson.response = responseJson.response.replace("<!--BUG_REPORT-->", "").trimEnd();
        }

        // Auto-log bug when bug keywords were detected
        if (isBugQuestion) {
          responseJson.is_bug_report = true;
          responseJson.bug_auto_logged = false;

          try {
            const sb = createClient(
              Deno.env.get("SUPABASE_URL")!,
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
            );
            const { data: profile } = await sb
              .from("profiles")
              .select("id, company_id")
              .eq("user_id", user.id)
              .maybeSingle();

            if (profile) {
              const originalMsg = lastMessage
                .replace(/\[User is on the "[^"]*" page in Ordino\]\n?/g, "")
                .replace(/\[\s*(INSTRUCTIONS|Context|SYSTEM INSTRUCTION)[^\]]*\]?/gis, "")
                .replace(/\[\s*Page:[^\]]*\]\s*/gi, "")
                .replace(/\s{2,}/g, " ")
                .trim();
              const pageName = currentPage || "Unknown";
              const bugTitle = `[${pageName}] ${originalMsg.slice(0, 80)}`;

              const { data: inserted, error: insertErr } = await sb
                .from("feature_requests")
                .insert({
                  company_id: profile.company_id,
                  user_id: profile.id,
                  title: bugTitle,
                  description: `**Reported via Beacon on ${pageName} page:**\n${originalMsg}\n\n**Beacon response:**\n${(responseJson.response || "").slice(0, 500)}`,
                  category: "bug_report",
                  priority: "medium",
                  status: "open",
                  attachments: [],
                } as any)
                .select("id")
                .single();

              if (!insertErr && inserted) {
                responseJson.bug_auto_logged = true;
                responseJson.bug_id = inserted.id;
                console.log("Auto-logged bug for page:", pageName, "id:", inserted.id);

                // Fire-and-forget triage
                fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/triage-bug-report`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({ bug_id: inserted.id }),
                }).catch(e => console.error("Triage trigger failed:", e));

                // Fire-and-forget admin email alert
                try {
                  const { data: rep } = await sb
                    .from("profiles")
                    .select("display_name, first_name, last_name")
                    .eq("id", profile.id)
                    .maybeSingle();
                  const reporterName =
                    rep?.display_name ||
                    [rep?.first_name, rep?.last_name].filter(Boolean).join(" ") ||
                    "A user";
                  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-bug-alert`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    },
                    body: JSON.stringify({
                      bug_id: inserted.id,
                      bug_title: bugTitle,
                      bug_description: `**Reported via Beacon on ${pageName} page:**\n${originalMsg}\n\n**Beacon response:**\n${(responseJson.response || "").slice(0, 500)}`,
                      bug_priority: "medium",
                      company_id: profile.company_id,
                      reporter_name: reporterName,
                      reporter_user_id: profile.id,
                    }),
                  }).catch(e => console.error("Bug alert trigger failed:", e));
                } catch (e) {
                  console.error("Bug alert trigger error:", e);
                }
              } else {
                console.error("Auto-log bug insert failed:", insertErr);
              }
            }
          } catch (e) {
            console.error("Auto-log bug error (non-blocking):", e);
          }
        } else {
          responseJson.is_bug_report = false;
        }

        return new Response(JSON.stringify(responseJson), {
          status: beaconRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        // If not JSON, return as-is
        return new Response(responseText, {
          status: beaconRes.status,
          headers: { ...corsHeaders, "Content-Type": beaconRes.headers.get("Content-Type") || "application/json" },
        });
      }

    } else if (action === "create-bug") {
      // ── Conversational bug creation ──
      const body = await req.json();
      const dataProxyUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/beacon-data-proxy";

      // Get user's profile for company_id
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const bugRes = await fetch(dataProxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-beacon-key": BEACON_API_KEY,
        },
        body: JSON.stringify({
          action: "create_bug_from_conversation",
          params: {
            title: body.title,
            description: body.description,
            page: body.page,
            ai_diagnosis: body.ai_diagnosis,
            reporter_id: profile.id,
            company_id: profile.company_id,
          },
        }),
      });

      const bugData = await bugRes.text();
      return new Response(bugData, {
        status: bugRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "ingest") {
      beaconUrl = `${BEACON_API_URL}/api/ingest`;
      const formData = await req.formData();
      beaconReqInit = {
        method: "POST",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
        body: formData,
      };
    } else if (action === "knowledge-list") {
      beaconUrl = `${BEACON_API_URL}/api/knowledge/list`;
      beaconReqInit = {
        method: "GET",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
      };
    } else if (action === "file-content") {
      const sourceFile = url.searchParams.get("source_file") || "";
      beaconUrl = `${BEACON_API_URL}/api/knowledge/file-content?source_file=${encodeURIComponent(sourceFile)}`;
      beaconReqInit = {
        method: "GET",
        headers: {
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
      };
    } else if (action === "content-generate") {
      // Draft a blog/newsletter from a content candidate using Beacon's real LLM.
      const body = await req.json().catch(() => ({}));
      beaconUrl = `${BEACON_API_URL}/api/content/generate`;
      beaconReqInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
        },
        body: JSON.stringify(body),
      };
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const beaconRes = await fetch(beaconUrl!, beaconReqInit!);
    const responseBody = await beaconRes.text();

    return new Response(responseBody, {
      status: beaconRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": beaconRes.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    console.error("Beacon proxy error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
