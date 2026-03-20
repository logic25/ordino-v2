import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert on NYC DOB filing requirements. Given the filing type and project details, generate a checklist of required items for this specific filing.

Filing types and their typical requirements:
- ALT-1: Major alterations. Requires full plans, structural, energy code compliance, special inspections schedule
- ALT-2: Minor alterations. Requires plans, may need structural depending on scope
- ALT-3: Minor work. BPP in lieu of plans, minimal docs
- NB: New building. Full plans, surveys, geotech, environmental, zoning analysis
- DM: Demolition. Asbestos survey, utility disconnects, neighboring building protection
- Fire Alarm/Sprinkler: Requires FP-plans, hydraulic calcs, device schedules
- Pro-Cert: Professional certification path — additional PE/RA certification docs required

Return a JSON array of checklist items, each with:
- name: field/document name
- category: one of 'document', 'field', 'approval', 'inspection'
- required: boolean
- description: what's needed and why
- typical_source: where this info usually comes from (architect, engineer, owner, DOB, contractor)
- dob_now_field: the corresponding DOB NOW form field name if applicable (null if not)

Be thorough but practical. Include items specific to the filing type. For ALT-1 include energy code, special inspections, etc. For DM include ACP5, utility letters.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { filing_type, work_type, building_class, borough, project_description, project_id } = await req.json();

    const userPrompt = `Generate a filing checklist for:
- Filing Type: ${filing_type || "Unknown"}
- Work Type: ${work_type || "General construction"}
- Building Class: ${building_class || "Not specified"}
- Borough: ${borough || "Not specified"}
- Project Description: ${project_description || "Not provided"}

Return ONLY the JSON array, no markdown.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_checklist",
              description: "Generate a filing checklist for a NYC DOB project",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string", enum: ["document", "field", "approval", "inspection"] },
                        required: { type: "boolean" },
                        description: { type: "string" },
                        typical_source: { type: "string" },
                        dob_now_field: { type: "string", nullable: true },
                      },
                      required: ["name", "category", "required", "description", "typical_source"],
                    },
                  },
                },
                required: ["items"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_checklist" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let checklistItems: any[] = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      checklistItems = parsed.items || [];
    }

    // If project_id provided, store checklist items in the DB
    if (project_id && checklistItems.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // Get company_id from project
      const { data: proj } = await sb
        .from("projects")
        .select("company_id")
        .eq("id", project_id)
        .single();

      if (proj) {
        const itemsToInsert = checklistItems.map((item: any, idx: number) => ({
          company_id: proj.company_id,
          project_id,
          label: item.name,
          category: item.category === "document" ? "missing_document" : item.category,
          from_whom: item.typical_source || null,
          status: "open",
          sort_order: idx,
          requested_date: new Date().toISOString(),
        }));

        await sb.from("project_checklist_items").insert(itemsToInsert);
      }
    }

    return new Response(JSON.stringify({ items: checklistItems }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-project-checklist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
