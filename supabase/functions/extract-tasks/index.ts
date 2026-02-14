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
            content: `You are an intelligent assistant for a billing/collections team at a construction expediting firm. You have TWO jobs:

1. TASK EXTRACTION: Extract actionable follow-up tasks from notes logged by project managers after client interactions about invoices. Only extract tasks when the note clearly implies an action. Do NOT fabricate tasks from generic notes.

2. PROMISE-TO-PAY DETECTION: Detect if the client has made any promise to pay. Look for language like:
- "will pay by [date]"
- "promised to send payment [date]"
- "said they'd pay $X by [date]"
- "committed to paying"
- "check will be mailed by [date]"
- "wire transfer coming [date]"
- Any indication of a specific payment commitment with a date and/or amount

Today's date: ${today}
Context: Invoice ${invoice_number || "unknown"} for client ${client_name || "unknown"}, $${amount_due || 0} outstanding, ${days_overdue || 0} days overdue.`,
          },
          {
            role: "user",
            content: `Analyze this follow-up note for tasks AND payment promises:\n\n"${note_text}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_tasks_and_promises",
              description: "Extract actionable follow-up tasks and detect payment promises from the note.",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short action-oriented task title" },
                        task_type: { type: "string", enum: ["follow_up_call", "send_email", "send_document", "internal_review", "escalation", "other"] },
                        priority: { type: "integer", description: "1=critical, 2=high, 3=medium, 4=low" },
                        due_in_days: { type: "integer", description: "Days from today the task should be due" },
                        ai_recommended_action: { type: "string", description: "Brief explanation of why this task was extracted" },
                      },
                      required: ["title", "task_type", "priority", "due_in_days", "ai_recommended_action"],
                      additionalProperties: false,
                    },
                  },
                  promises: {
                    type: "array",
                    description: "Payment promises detected in the note. Empty array if none found.",
                    items: {
                      type: "object",
                      properties: {
                        promised_amount: { type: "number", description: "Amount promised. Use the invoice total if not specified." },
                        promised_date: { type: "string", description: "ISO date string (YYYY-MM-DD) of when they promised to pay" },
                        payment_method: { type: "string", enum: ["check", "wire", "ach", "credit_card", "cash", "unknown"], description: "Payment method mentioned" },
                        confidence: { type: "string", enum: ["high", "medium", "low"], description: "How confident you are this is a real promise" },
                        summary: { type: "string", description: "Brief summary of the promise for display" },
                      },
                      required: ["promised_amount", "promised_date", "payment_method", "confidence", "summary"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks", "promises"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_tasks_and_promises" } },
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
      return new Response(JSON.stringify({ tasks: [], promises: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ tasks: [], promises: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tasks = extracted.tasks || [];
    const promises = extracted.promises || [];

    // Insert tasks into collection_tasks
    let insertedTasks: any[] = [];
    if (tasks.length > 0) {
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

      const { data, error: insertError } = await supabaseAdmin
        .from("collection_tasks")
        .insert(insertRows)
        .select();

      if (insertError) {
        console.error("Task insert error:", insertError);
      } else {
        insertedTasks = data || [];
      }
    }

    // Insert promises into payment_promises (only medium/high confidence)
    let insertedPromises: any[] = [];
    if (promises.length > 0) {
      // Get client_id from invoice
      const { data: invoiceData } = await supabaseAdmin
        .from("invoices")
        .select("client_id")
        .eq("id", invoice_id)
        .single();

      const promiseRows = promises
        .filter((p: any) => p.confidence !== "low")
        .map((p: any) => ({
          invoice_id: invoice_id,
          company_id: profile.company_id,
          client_id: invoiceData?.client_id || null,
          promised_amount: p.promised_amount || amount_due || 0,
          promised_date: p.promised_date,
          payment_method: p.payment_method === "unknown" ? null : p.payment_method,
          source: "ai_detected",
          captured_by: profile.id,
          notes: `[AI detected] ${p.summary}`,
          status: "pending",
        }));

      if (promiseRows.length > 0) {
        const { data, error: promiseError } = await supabaseAdmin
          .from("payment_promises")
          .insert(promiseRows)
          .select();

        if (promiseError) {
          console.error("Promise insert error:", promiseError);
        } else {
          insertedPromises = data || [];
        }
      }
    }

    const taskResult = tasks.map((t: any, i: number) => ({
      ...t,
      id: insertedTasks?.[i]?.id || null,
      due_date: new Date(Date.now() + (t.due_in_days || 1) * 86400000).toISOString().split("T")[0],
    }));

    const promiseResult = promises
      .filter((p: any) => p.confidence !== "low")
      .map((p: any, i: number) => ({
        ...p,
        id: insertedPromises?.[i]?.id || null,
      }));

    return new Response(JSON.stringify({ tasks: taskResult, promises: promiseResult }), {
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
