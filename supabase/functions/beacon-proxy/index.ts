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
      const beaconRes = await fetch(`${BEACON_API_URL}/`, { method: "GET" });
      const responseBody = await beaconRes.text();
      return new Response(responseBody, {
        status: beaconRes.status,
        headers: { ...corsHeaders, "Content-Type": beaconRes.headers.get("Content-Type") || "application/json" },
      });
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

    // For ingest, check admin role
    if (action === "ingest") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r: { role: string }) => r.role === "admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required for ingestion" }), {
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

      // ── Page & error context injection ──
      const projectCtx = body.project_context || {};
      const currentPage = projectCtx.currentPage || projectCtx.current_page || "";
      const recentErrors = projectCtx.recentErrors || projectCtx.recent_errors || [];

      // ── Bug Triage Sub-Agent routing ──
      const lastMessage = body.message || body.messages?.[body.messages?.length - 1]?.content || "";
      const isBugQuestion = /\b(bug|broken|error|crash|fail|not working|issue|fix|wrong|stuck|breaking|doesn't work|can't|cannot|won't)\b/i.test(lastMessage);

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
              dataQueries.push({
                action: "vendor_lookup",
                params: { type: typeMatch ? typeMatch[1] : undefined },
                label: "vendor recommendations",
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
                  const vendorLines = (data.vendors || []).map((v: any) => {
                    const parts: string[] = [`• **${v.name}**`];
                    if (v.type) parts.push(`(${v.type})`);
                    if (v.borough) parts.push(`— ${v.borough}`);
                    if (v.avg_rating) parts.push(`⭐ ${v.avg_rating}/5 (${v.review_count})`);
                    else parts.push(`no reviews yet`);
                    let line = parts.join(" ");
                    if (v.responsiveness) {
                      line += ` | ⚡ ${v.responsiveness.bucket} (~${v.responsiveness.medianHours}h reply)`;
                    }
                    if (v.past_jobs_count > 0) {
                      line += ` | ${v.past_jobs_count} past job${v.past_jobs_count > 1 ? "s" : ""} together`;
                      if (v.last_worked?.month) line += ` (last: ${v.last_worked.month}${v.last_worked.address ? " — " + v.last_worked.address : ""})`;
                    }
                    if (v.specialty_tags?.length) line += ` | Specialties: ${v.specialty_tags.join(", ")}`;
                    if (v.contact) line += `\n  Contact: ${v.contact.name}${v.contact.email ? ` <${v.contact.email}>` : ""}${v.contact.phone ? ` ${v.contact.phone}` : ""}`;
                    if (v.recent_reviews?.length > 0 && v.recent_reviews[0].text) {
                      line += `\n  Latest review (${v.recent_reviews[0].rating}★): "${v.recent_reviews[0].text}" — ${v.recent_reviews[0].reviewer}`;
                    }
                    if (v.internal_notes) line += `\n  Internal note: ${v.internal_notes.slice(0, 160)}`;
                    return line;
                  }).join("\n");
                  dataContext.push(`**Partner recommendations from our database (${data.count} found):**\nPresent these as YOUR recommendations from the company's vetted partner list. Prefer partners with high ratings, fast responsiveness, and past projects together. Include contact info.\n${vendorLines}`);
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
            body.system_context = (body.system_context || "") +
              `\n\n**LIVE DATABASE RESULTS (use these to answer the user's question accurately):**\n${dataContext.join("\n")}`;
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

      beaconReqInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BEACON_API_KEY ? { "x-beacon-key": BEACON_API_KEY } : {}),
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
                .replace(/\[SYSTEM INSTRUCTION:.*?\]/gs, "")
                .trim();
              const pageName = currentPage || "Unknown";

              const { data: inserted, error: insertErr } = await sb
                .from("feature_requests")
                .insert({
                  company_id: profile.company_id,
                  user_id: profile.id,
                  title: `[${pageName}] ${originalMsg.slice(0, 80)}`,
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
