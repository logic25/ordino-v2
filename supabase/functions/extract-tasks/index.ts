import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", user.id)
      .single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { note_text, invoice_id, client_name, invoice_number, days_overdue, amount_due } = body;

    if (!note_text || !invoice_id) {
      return new Response(JSON.stringify({ error: "note_text and invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a task extraction assistant for a billing/collections team at a construction expediting firm. Extract actionable follow-up tasks from notes logged by project managers after client interactions about invoices.

Today's date: ${today}
Context: Invoice ${invoice_number || "unknown"} for client ${client_name || "unknown"}, $${amount_due || 0} outstanding, ${days_overdue || 0} days overdue.

Extract 0-3 concrete tasks. Only extract tasks when the note clearly implies an action. Do NOT fabricate tasks from generic notes like "left voicemail" unless there's a specific follow-up implied.`,
          },
          {
            role: "user",
            content: `Extract tasks from this follow-up note:\n\n"${note_text}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_tasks",
              description: "Extract actionable follow-up tasks from the note.",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short action-oriented task title (e.g., 'Send updated invoice to AP dept')" },
                        task_type: { type: "string", enum: ["follow_up_call", "send_email", "send_document", "internal_review", "escalation", "other"], description: "Type of task" },
                        priority: { type: "integer", description: "1=critical, 2=high, 3=medium, 4=low" },
                        due_in_days: { type: "integer", description: "Days from today the task should be due" },
                        ai_recommended_action: { type: "string", description: "Brief explanation of why this task was extracted and what to do" },
                      },
                      required: ["title", "task_type", "priority", "due_in_days", "ai_recommended_action"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_tasks" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ tasks: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ tasks: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tasks = extracted.tasks || [];
    if (tasks.length === 0) {
      return new Response(JSON.stringify({ tasks: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert tasks into collection_tasks
    const insertRows = tasks.map((t: any) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (t.due_in_days || 1));
      return {
        invoice_id: invoice_id,
        company_id: profile.company_id,
        assigned_to: profile.id,
        priority: t.priority || 3,
        task_type: t.task_type || "other",
        due_date: dueDate.toISOString().split("T")[0],
        ai_recommended_action: t.ai_recommended_action || t.title,
        ai_suggested_message: null,
        status: "pending",
      };
    });

    const { data: insertedTasks, error: insertError } = await supabaseAdmin
      .from("collection_tasks")
      .insert(insertRows)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      // Still return the extracted tasks even if insert fails
    }

    const result = tasks.map((t: any, i: number) => ({
      ...t,
      id: insertedTasks?.[i]?.id || null,
      due_date: insertRows[i].due_date,
    }));

    return new Response(JSON.stringify({ tasks: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-tasks error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
