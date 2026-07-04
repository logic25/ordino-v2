import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Architectural context per page — injected into AI prompt for precise triage
const PAGE_CONTEXT: Record<string, string> = {
  Properties: `Uses NYC GeoSearch API → PLUTO cross-verification in useNYCPropertyLookup.ts. Common failure: strict street name validation rejects named buildings (e.g. '5 Times Square' maps to '592 7 Avenue' in PLUTO). The verifyBBLWithPLUTO function confirms BBL but streetNamesMatch can reject valid results. Also uses useBuildingLookup.ts for Google Places integration. AKA addresses fetched from NYC PAD dataset by BIN.`,
  Proposals: `Proposal creation in ProposalDialog.tsx, sending via SendProposalDialog.tsx. Common failures: (1) signature canvas init runs before proposal data loads — fix: add proposal to effect dependency array in SignatureDialog.tsx. (2) Logo broken in emails — Gmail strips base64 data URLs from img tags; fix: use HTTPS public storage URL for emails, keep base64 for preview iframe only. (3) Send dialog not scrollable — fix: use flex layout with min-h-0 and overflow-y-auto on dialog body.`,
  Email: `Gmail OAuth integration via gmail-sync and gmail-send edge functions. Thread model with gmail_thread_id. Common failures: OAuth token refresh, thread association for replies, attachment size limits.`,
  RFPs: `RFP board with partner outreach. Partners respond via public link (rfp-partner-response edge function). Common failures: M/WBE attachment uploads, partner response not linking back to RFP, file size limits on rfp-documents bucket.`,
  Projects: `PIS (Project Information Sheet) syncs to project via sync_pis_to_project trigger. Phase auto-advance via auto_advance_project_phase trigger. Common failures: PIS data not syncing when submitted, phase not advancing when all apps approved, filing readiness calculation.`,
  "Invoices / Billing": `Invoice generation with INV- numbering. Payment plans, ACH authorizations, automation rules for collections. Common failures: invoice number collisions, payment plan calculations, automation rule cooldown logic.`,
  Dashboard: `Dashboard with configurable layout (useDashboardLayout). Widgets fetch from multiple tables. Common failures: slow queries on large datasets, widget data not refreshing.`,
  "Help Center": `Bug reports stored in feature_requests table with category='bug_report'. Auto-triage via triage-bug-report edge function. Bug comments, activity logs, fix tracking.`,
};

// Page-to-file mapping for the Ordino codebase
const PAGE_FILE_MAP: Record<string, string[]> = {
  "Dashboard": [
    "src/pages/Dashboard.tsx",
    "src/components/dashboard/",
    "src/hooks/useDashboardLayout.ts",
  ],
  "Projects": [
    "src/pages/Projects.tsx",
    "src/pages/ProjectDetail.tsx",
    "src/components/projects/",
    "src/hooks/useProjects.ts",
  ],
  "Properties": [
    "src/pages/Properties.tsx",
    "src/pages/PropertyDetail.tsx",
    "src/components/properties/",
    "src/hooks/useBuildingLookup.ts",
  ],
  "Proposals": [
    "src/pages/Proposals.tsx",
    "src/components/proposals/ProposalDialog.tsx",
    "src/components/proposals/SendProposalDialog.tsx",
    "src/hooks/useProposals.ts",
  ],
  "Invoices / Billing": [
    "src/pages/Invoices.tsx",
    "src/components/billing/",
    "src/hooks/useInvoices.ts",
  ],
  "Time": [
    "src/pages/Time.tsx",
    "src/components/time/",
    "src/hooks/useTimeEntries.ts",
  ],
  "Email": [
    "src/pages/EmailInbox.tsx",
    "src/components/email/",
    "src/hooks/useEmails.ts",
    "supabase/functions/gmail-send/index.ts",
    "supabase/functions/gmail-sync/index.ts",
  ],
  "Calendar": [
    "src/pages/Calendar.tsx",
    "src/components/calendar/",
    "src/hooks/useCalendarEvents.ts",
  ],
  "RFPs": [
    "src/pages/RfpBoard.tsx",
    "src/components/rfps/",
    "src/hooks/useRfps.ts",
    "supabase/functions/rfp-partner-response/index.ts",
  ],
  "Reports": [
    "src/pages/Reports.tsx",
    "src/components/reports/",
  ],
  "Companies / Clients": [
    "src/pages/Clients.tsx",
    "src/pages/ClientDetail.tsx",
    "src/components/clients/",
  ],
  "Documents": [
    "src/pages/Documents.tsx",
    "src/components/documents/",
  ],
  "Settings": [
    "src/pages/Settings.tsx",
    "src/components/settings/",
  ],
  "Auth / Login": [
    "src/pages/Auth.tsx",
    "src/hooks/useAuth.ts",
  ],
  "Help Center": [
    "src/pages/HelpDesk.tsx",
    "src/components/helpdesk/",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Auth: verify caller JWT ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bug_id, action } = await req.json();
    if (!bug_id) {
      return new Response(JSON.stringify({ error: "bug_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Verify caller belongs to the same company as the bug ----
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const { data: bugCompanyRow } = await supabase
      .from("feature_requests")
      .select("company_id")
      .eq("id", bug_id)
      .maybeSingle();
    if (
      !callerProfile?.company_id ||
      !bugCompanyRow?.company_id ||
      callerProfile.company_id !== bugCompanyRow.company_id
    ) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Handle pattern learning on resolve
    if (action === "learn_pattern") {
      const { data: bug } = await supabase
        .from("feature_requests")
        .select("*")
        .eq("id", bug_id)
        .single();

      if (!bug || !bug.ai_diagnosis) {
        return new Response(JSON.stringify({ message: "No diagnosis to learn from" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pageMatch = bug.title?.match(/^\[([^\]]+)\]/);
      const patternName = `${pageMatch ? pageMatch[1] : "Unknown"}: ${bug.title?.replace(/^\[[^\]]+\]\s*/, "").slice(0, 60)}`;
      const affectedFiles = bug.files_changed || bug.ai_suggested_files || [];

      // Check for existing similar pattern
      const { data: existing } = await supabase
        .from("bug_patterns")
        .select("*")
        .eq("company_id", bug.company_id);

      const similar = (existing || []).find((p: any) => {
        const pFiles = p.affected_files || [];
        return pFiles.some((f: string) => affectedFiles.includes(f));
      });

      if (similar) {
        await supabase.from("bug_patterns").update({
          occurrences: similar.occurrences + 1,
          last_seen: new Date().toISOString(),
          fix_pattern: bug.fix_description || similar.fix_pattern,
        }).eq("id", similar.id);
      } else {
        await supabase.from("bug_patterns").insert({
          company_id: bug.company_id,
          pattern_name: patternName,
          affected_files: affectedFiles,
          root_cause: bug.ai_diagnosis?.split("\n").find((l: string) => l.includes("Root cause"))?.replace(/.*Root cause:\*?\*?\s*/i, "") || null,
          fix_pattern: bug.fix_description || null,
        });
      }

      return new Response(JSON.stringify({ success: true, action: "pattern_learned" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the bug report
    const { data: bug, error: bugErr } = await supabase
      .from("feature_requests")
      .select("*")
      .eq("id", bug_id)
      .single();

    if (bugErr || !bug) {
      console.error("Bug not found:", bug_id, bugErr);
      return new Response(JSON.stringify({ error: "Bug not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already triaged
    if (bug.ai_triaged_at) {
      return new Response(JSON.stringify({ message: "Already triaged" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract page from title like "[Properties] ..."
    const pageMatch = bug.title?.match(/^\[([^\]]+)\]/);
    const pageName = pageMatch ? pageMatch[1] : "Other";
    const suggestedFiles = PAGE_FILE_MAP[pageName] || [];

    // Check for existing patterns
    const { data: patterns } = await supabase
      .from("bug_patterns")
      .select("*")
      .eq("company_id", bug.company_id)
      .order("occurrences", { ascending: false })
      .limit(10);

    const matchingPatterns = (patterns || []).filter((p: any) => {
      const affectedFiles = p.affected_files || [];
      const hasFileOverlap = affectedFiles.some((f: string) =>
        suggestedFiles.some((sf: string) => sf.includes(f) || f.includes(sf))
      );
      const hasKeywordMatch = p.pattern_name && bug.description &&
        p.pattern_name.toLowerCase().split(" ").some((w: string) =>
          w.length > 3 && bug.description.toLowerCase().includes(w)
        );
      return hasFileOverlap || hasKeywordMatch;
    });

    // Build AI prompt
    const pageContext = PAGE_CONTEXT[pageName] || "";
    const prompt = `You are an expert software engineer triaging a bug report for "Ordino", a React/TypeScript CRM built with Supabase, Vite, Tailwind, and shadcn/ui.

Bug Report:
- Title: ${bug.title}
- Priority (user-set): ${bug.priority}
- Description: ${bug.description}
- Page: ${pageName}
- Loom URL: ${bug.loom_url || "none"}
- Screenshots: ${bug.attachments ? JSON.stringify(bug.attachments) : "none"}

Likely source files for this page: ${suggestedFiles.join(", ")}

${pageContext ? `**Architecture context for ${pageName}:**\n${pageContext}\n` : ""}
${matchingPatterns.length > 0 ? `Known patterns that may match:\n${matchingPatterns.map((p: any) => `- "${p.pattern_name}": ${p.root_cause} (seen ${p.occurrences} times, fix: ${p.fix_pattern || "N/A"})`).join("\n")}` : ""}

Analyze this bug and provide a triage assessment. Use the architecture context and known patterns to identify the SPECIFIC root cause — not generic guesses.`;

    // Call AI with tool-calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a senior software engineer performing bug triage. Be specific and actionable." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "triage_bug",
              description: "Provide a structured triage assessment of a bug report",
              parameters: {
                type: "object",
                properties: {
                  severity: {
                    type: "string",
                    enum: ["critical", "high", "medium", "low"],
                    description: "Assessed severity based on impact and scope",
                  },
                  root_cause: {
                    type: "string",
                    description: "Likely root cause of the bug (1-2 sentences)",
                  },
                  suggested_files: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific file paths most likely needing changes",
                  },
                  fix_complexity: {
                    type: "string",
                    enum: ["quick", "moderate", "complex"],
                    description: "Estimated fix complexity",
                  },
                  suggested_fix: {
                    type: "string",
                    description: "Brief description of the recommended fix approach",
                  },
                },
                required: ["severity", "root_cause", "suggested_files", "fix_complexity", "suggested_fix"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "triage_bug" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const triage = JSON.parse(toolCall.function.arguments);

    // Build diagnosis text
    const complexityEmoji = triage.fix_complexity === "quick" ? "⚡" : triage.fix_complexity === "moderate" ? "🔧" : "🏗️";
    const severityEmoji = triage.severity === "critical" ? "🔴" : triage.severity === "high" ? "🟠" : triage.severity === "medium" ? "🟡" : "🟢";

    let diagnosisText = `${severityEmoji} **Severity:** ${triage.severity.toUpperCase()}\n`;
    diagnosisText += `📁 **Likely files:** ${triage.suggested_files.join(", ")}\n`;
    diagnosisText += `🔍 **Root cause:** ${triage.root_cause}\n`;
    diagnosisText += `💡 **Suggested fix:** ${triage.suggested_fix}\n`;
    diagnosisText += `${complexityEmoji} **Complexity:** ${triage.fix_complexity}`;

    if (matchingPatterns.length > 0) {
      const p = matchingPatterns[0];
      diagnosisText += `\n\n⚡ **Known pattern:** This matches "${p.pattern_name}" (seen ${p.occurrences} time${p.occurrences > 1 ? "s" : ""} before). Previous fix: ${p.fix_pattern || "N/A"}`;
    }

    // NOTE: AI triage is shown in the top AI Diagnosis card + activity log.
    // We intentionally do NOT post it as a bug_comment to avoid duplication.


    // Log activity
    await supabase.from("bug_activity_logs").insert({
      bug_id: bug.id,
      company_id: bug.company_id,
      user_id: null,
      action_type: "ai_triage",
      note: `AI triage: ${triage.severity} severity, ${triage.fix_complexity} fix`,
    });

    // Update bug with triage data
    await supabase.from("feature_requests").update({
      ai_severity: triage.severity,
      ai_diagnosis: diagnosisText,
      ai_suggested_files: triage.suggested_files,
      ai_triaged_at: new Date().toISOString(),
    }).eq("id", bug.id);

    // Update matching pattern occurrence count
    if (matchingPatterns.length > 0) {
      await supabase.from("bug_patterns").update({
        occurrences: matchingPatterns[0].occurrences + 1,
        last_seen: new Date().toISOString(),
      }).eq("id", matchingPatterns[0].id);
    }

    console.log("Triage complete for bug:", bug_id, "severity:", triage.severity);

    return new Response(JSON.stringify({
      success: true,
      severity: triage.severity,
      fix_complexity: triage.fix_complexity,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Triage error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
