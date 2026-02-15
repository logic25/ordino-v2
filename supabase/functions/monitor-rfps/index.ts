import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { company_id } = await req.json();
    if (!company_id) throw new Error("company_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch active sources for this company
    const { data: sources, error: srcErr } = await sb
      .from("rfp_sources")
      .select("*")
      .eq("company_id", company_id)
      .eq("active", true);
    if (srcErr) throw srcErr;

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ new_count: 0, total_scanned: 0, sources_checked: 0, message: "No active sources configured." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch monitoring rules for keyword context
    const { data: rules } = await sb
      .from("rfp_monitoring_rules")
      .select("*")
      .eq("company_id", company_id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    const minScore = rules?.min_relevance_score ?? 60;

    let totalScanned = 0;
    let newCount = 0;
    const allListings: any[] = [];

    // Fetch each source page and extract listings
    for (const source of sources) {
      try {
        const response = await fetch(source.source_url, {
          headers: { "User-Agent": "Ordino-RFP-Monitor/1.0" },
        });
        if (!response.ok) {
          console.error(`Failed to fetch ${source.source_name}: ${response.status}`);
          continue;
        }
        const html = await response.text();

        // Extract potential RFP listings using AI
        if (!lovableKey) {
          console.error("LOVABLE_API_KEY not set, skipping AI extraction");
          continue;
        }

        const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You extract RFP/procurement opportunity listings from HTML pages. Return a JSON array of objects with these fields:
- title (string): The RFP title
- rfp_number (string|null): The RFP/solicitation number if visible
- issuing_agency (string|null): The issuing agency  
- due_date (string|null): Due date in YYYY-MM-DD format if found
- url (string|null): Link to the RFP detail page (absolute URL preferred)
- pdf_url (string|null): Direct link to PDF if visible

Only include items that appear to be active procurement opportunities (RFPs, RFQs, solicitations). Ignore navigation, headers, footers. If no listings found, return an empty array.`,
              },
              {
                role: "user",
                content: `Source: ${source.source_name} (${source.source_url})\n\nHTML content (first 15000 chars):\n${html.slice(0, 15000)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_listings",
                  description: "Extract RFP listings from the page",
                  parameters: {
                    type: "object",
                    properties: {
                      listings: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            rfp_number: { type: "string" },
                            issuing_agency: { type: "string" },
                            due_date: { type: "string" },
                            url: { type: "string" },
                            pdf_url: { type: "string" },
                          },
                          required: ["title"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["listings"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "extract_listings" } },
          }),
        });

        if (!extractionResponse.ok) {
          const status = extractionResponse.status;
          console.error(`AI extraction failed for ${source.source_name}: ${status}`);
          if (status === 429 || status === 402) {
            // Rate limited or payment required - stop processing
            break;
          }
          continue;
        }

        const extractionData = await extractionResponse.json();
        const toolCall = extractionData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) continue;

        let listings: any[] = [];
        try {
          const args = JSON.parse(toolCall.function.arguments);
          listings = args.listings || [];
        } catch {
          console.error(`Failed to parse extraction result for ${source.source_name}`);
          continue;
        }

        totalScanned += listings.length;

        for (const listing of listings) {
          allListings.push({ ...listing, source_id: source.id, source_name: source.source_name });
        }

        // Update last_checked_at
        await sb
          .from("rfp_sources")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", source.id);
      } catch (err) {
        console.error(`Error processing source ${source.source_name}:`, err);
      }
    }

    // Deduplicate against existing discovered_rfps
    const existingUrls = new Set<string>();
    const existingTitles = new Set<string>();
    if (allListings.length > 0) {
      const { data: existing } = await sb
        .from("discovered_rfps")
        .select("original_url, title")
        .eq("company_id", company_id);
      if (existing) {
        existing.forEach((e: any) => {
          if (e.original_url) existingUrls.add(e.original_url);
          if (e.title) existingTitles.add(e.title.toLowerCase().trim());
        });
      }
    }

    const newListings = allListings.filter((l) => {
      if (l.url && existingUrls.has(l.url)) return false;
      if (existingTitles.has(l.title.toLowerCase().trim())) return false;
      return true;
    });

    // Score relevance for new listings using AI
    for (const listing of newListings) {
      try {
        let relevanceScore = 50;
        let relevanceReason = "Default score - AI scoring unavailable";
        let serviceTags: string[] = [];

        if (lovableKey) {
          const keywordsContext = rules
            ? `Include keywords: ${(rules.keyword_include || []).join(", ")}\nExclude keywords: ${(rules.keyword_exclude || []).join(", ")}`
            : "";

          const scoreResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `You assess RFP relevance for a construction consulting/expediting firm. Services include DOB permit expediting, FDNY code consulting, zoning analysis, energy compliance, certificate of occupancy assistance, and building code consulting.\n\n${keywordsContext}`,
                },
                {
                  role: "user",
                  content: `Score this RFP:\nTitle: ${listing.title}\nAgency: ${listing.issuing_agency || "Unknown"}\nRFP#: ${listing.rfp_number || "N/A"}`,
                },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "score_rfp",
                    description: "Score RFP relevance",
                    parameters: {
                      type: "object",
                      properties: {
                        relevance_score: { type: "number", description: "0-100 relevance score" },
                        relevance_reason: { type: "string", description: "Brief explanation" },
                        service_tags: {
                          type: "array",
                          items: { type: "string" },
                          description: "Matching service tags like dob_expediting, fdny, consulting, energy, zoning",
                        },
                        estimated_value: { type: "number", description: "Estimated contract value if determinable, null otherwise" },
                      },
                      required: ["relevance_score", "relevance_reason", "service_tags"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "score_rfp" } },
            }),
          });

          if (scoreResponse.ok) {
            const scoreData = await scoreResponse.json();
            const scoreCall = scoreData.choices?.[0]?.message?.tool_calls?.[0];
            if (scoreCall) {
              const args = JSON.parse(scoreCall.function.arguments);
              relevanceScore = args.relevance_score ?? 50;
              relevanceReason = args.relevance_reason ?? "";
              serviceTags = args.service_tags ?? [];
              if (args.estimated_value) listing.estimated_value = args.estimated_value;
            }
          } else if (scoreResponse.status === 429 || scoreResponse.status === 402) {
            break;
          }
        }

        // Only insert if above threshold
        if (relevanceScore >= minScore) {
          const { error: insertErr } = await sb.from("discovered_rfps").insert({
            company_id,
            source_id: listing.source_id,
            title: listing.title,
            rfp_number: listing.rfp_number || null,
            issuing_agency: listing.issuing_agency || listing.source_name || null,
            due_date: listing.due_date ? new Date(listing.due_date).toISOString() : null,
            original_url: listing.url || null,
            pdf_url: listing.pdf_url || null,
            relevance_score: relevanceScore,
            relevance_reason: relevanceReason,
            service_tags: serviceTags,
            estimated_value: listing.estimated_value || null,
            status: "new",
          });
          if (!insertErr) newCount++;
          else console.error("Insert error:", insertErr);
        }
      } catch (err) {
        console.error("Error scoring listing:", err);
      }
    }

    return new Response(
      JSON.stringify({ new_count: newCount, total_scanned: totalScanned, sources_checked: sources.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("monitor-rfps error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
