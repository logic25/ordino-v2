// Beacon Concierge — email-only inbound handler
// Deterministic structured-data summarizer for client emails.
// - Verifies SPF/DKIM (from webhook payload)
// - Matches sender to client_contacts.email
// - Classifies into fixed intent set (status | next_step | invoice | book_call)
// - Anything else -> escalates to assigned PM
// - Never reads notes, never uses Beacon RAG, never sends documents.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_REPLIES_PER_DAY = 10;
const STAGE_LABEL: Record<string, string> = {
  pre_filing: "Pre-filing",
  filed: "Filed",
  in_review: "In Review",
  objections: "Objections",
  approved: "Approved",
  permit_issued: "Permit Issued",
  sign_off: "Sign-off / LOC",
};

interface InboundPayload {
  from: string;
  subject?: string;
  text: string;
  spf_pass?: boolean;
  dkim_pass?: boolean;
  message_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: InboundPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const senderEmail = (payload.from || "").trim().toLowerCase();
  if (!senderEmail || !payload.text) {
    return json({ error: "missing_fields" }, 400);
  }

  const spfDkimOk = payload.spf_pass !== false && payload.dkim_pass !== false;

  // 1. Try to match sender to a client contact (regardless of verification, so we can log)
  const { data: contact } = await supabase
    .from("client_contacts")
    .select("id, client_id, company_id, first_name, last_name, name, email")
    .ilike("email", senderEmail)
    .maybeSingle();

  // No match → polite handoff, but nothing to log against (no company_id).
  if (!contact) {
    return json({
      status: "unrecognized_sender",
      reply: "Thanks for reaching out. We couldn't match this address to a client account — please contact your project manager directly and they'll be happy to help.",
    });
  }

  const companyId = contact.company_id;
  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name || "there";

  // 2. SPF/DKIM check — do not answer, but log and notify.
  if (!spfDkimOk) {
    const reply = `Hi ${contactName}, for security reasons please contact your project manager directly at their known email address.`;
    await logConversation(supabase, {
      company_id: companyId,
      client_contact_id: contact.id,
      client_id: contact.client_id,
      sender_email: senderEmail,
      sender_verified: false,
      inbound_subject: payload.subject ?? null,
      inbound_text: payload.text,
      matched_intent: "unverified_sender",
      outbound_text: reply,
      escalated: true,
    });
    return json({ status: "unverified_sender", reply });
  }

  // 3. Rate limit
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("concierge_conversations")
    .select("id", { count: "exact", head: true })
    .eq("sender_email", senderEmail)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_REPLIES_PER_DAY) {
    return json({ status: "rate_limited" }, 429);
  }

  // 4. Resolve client's projects (hard filter)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, project_number, portal_overall_stage, portal_next_action, assigned_pm_id, updated_at, properties(address)")
    .eq("company_id", companyId)
    .eq("client_id", contact.client_id);

  const projectList = projects ?? [];
  if (projectList.length === 0) {
    const reply = `Hi ${contactName}, I don't see any active projects under your account yet. Please reach out to your project manager for help.`;
    await logConversation(supabase, {
      company_id: companyId,
      client_contact_id: contact.id,
      client_id: contact.client_id,
      sender_email: senderEmail,
      sender_verified: true,
      inbound_subject: payload.subject ?? null,
      inbound_text: payload.text,
      matched_intent: "no_projects",
      outbound_text: reply,
      escalated: false,
    });
    return json({ status: "no_projects", reply });
  }

  // 5. Classify intent
  const classification = await classify(payload.text, projectList);
  const { intent, project_id: matchedProjectId, confidence } = classification;

  const matchedProject =
    projectList.find((p) => p.id === matchedProjectId) ??
    (projectList.length === 1 ? projectList[0] : null);

  const pmProfile = matchedProject?.assigned_pm_id
    ? await getPmProfile(supabase, matchedProject.assigned_pm_id)
    : null;
  const pmName = pmProfile?.name ?? "your PM";
  const pmSuffix = ` For anything more, your PM ${pmName} can help.`;

  // 6. Handle intent
  if (intent === "escalate" || !matchedProject || confidence < 0.6) {
    const reply = `Hi ${contactName}, I've looped in ${pmName} — they'll follow up with you today.`;
    if (matchedProject && matchedProject.assigned_pm_id) {
      await supabase.from("project_action_items").insert({
        company_id: companyId,
        project_id: matchedProject.id,
        title: `Concierge: reply to ${contactName} (${senderEmail})`,
        description: `Client email:\n\n${payload.text}\n\n— Auto-escalated by Beacon Concierge.`,
        assigned_to: matchedProject.assigned_pm_id,
        priority: "high",
      });
    }
    await logConversation(supabase, {
      company_id: companyId,
      client_contact_id: contact.id,
      client_id: contact.client_id,
      project_id: matchedProject?.id ?? null,
      sender_email: senderEmail,
      sender_verified: true,
      inbound_subject: payload.subject ?? null,
      inbound_text: payload.text,
      matched_intent: "escalate",
      intent_confidence: confidence,
      outbound_text: reply,
      escalated: true,
      pm_user_id: matchedProject?.assigned_pm_id ?? null,
    });
    return json({ status: "escalated", reply });
  }

  let reply = "";
  const asOf = matchedProject.updated_at
    ? new Date(matchedProject.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "today";
  const projLabel =
    matchedProject.project_number ||
    (matchedProject.properties as any)?.address ||
    matchedProject.name ||
    "your project";

  if (intent === "status") {
    const stage = matchedProject.portal_overall_stage;
    const label = stage ? STAGE_LABEL[stage] ?? stage : "not yet recorded";
    reply = `Hi ${contactName}, current status on ${projLabel}: **${label}** (as of ${asOf}, per our records).${pmSuffix}`;
  } else if (intent === "next_step") {
    const next = matchedProject.portal_next_action;
    reply = next
      ? `Hi ${contactName}, next step on ${projLabel}: ${next} (as of ${asOf}, per our records).${pmSuffix}`
      : `Hi ${contactName}, no next step is scheduled on ${projLabel} yet (as of ${asOf}).${pmSuffix}`;
  } else if (intent === "invoice") {
    const { data: inv } = await supabase
      .from("invoices")
      .select("balance_due, total_amount, amount_paid, status")
      .eq("company_id", companyId)
      .eq("project_id", matchedProject.id)
      .neq("status", "paid");
    const balance = (inv ?? []).reduce((s: number, r: any) => s + Number(r.balance_due ?? (r.total_amount ?? 0) - (r.amount_paid ?? 0)), 0);
    reply = balance > 0
      ? `Hi ${contactName}, open balance on ${projLabel}: $${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (as of ${asOf}, per our records).${pmSuffix}`
      : `Hi ${contactName}, there is no open balance on ${projLabel} (as of ${asOf}, per our records).${pmSuffix}`;
  } else if (intent === "book_call") {
    const link = pmProfile?.scheduling_link;
    reply = link
      ? `Hi ${contactName}, you can book time with ${pmName} here: ${link}.${pmSuffix}`
      : `Hi ${contactName}, ${pmName} will reach out shortly to schedule a call.${pmSuffix}`;
    // also log a task so PM sees the request
    if (matchedProject.assigned_pm_id) {
      await supabase.from("project_action_items").insert({
        company_id: companyId,
        project_id: matchedProject.id,
        title: `Concierge: ${contactName} requested a call`,
        description: `${contactName} <${senderEmail}> asked to book time.\n\nOriginal message:\n${payload.text}`,
        assigned_to: matchedProject.assigned_pm_id,
        priority: "normal",
      });
    }
  }

  await logConversation(supabase, {
    company_id: companyId,
    client_contact_id: contact.id,
    client_id: contact.client_id,
    project_id: matchedProject.id,
    sender_email: senderEmail,
    sender_verified: true,
    inbound_subject: payload.subject ?? null,
    inbound_text: payload.text,
    matched_intent: intent,
    intent_confidence: confidence,
    outbound_text: reply,
    escalated: false,
    pm_user_id: matchedProject.assigned_pm_id,
  });

  return json({ status: "answered", intent, reply });
});

async function getPmProfile(supabase: any, pmId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, display_name")
    .eq("id", pmId)
    .maybeSingle();
  if (!data) return null;
  const name = data.display_name || [data.first_name, data.last_name].filter(Boolean).join(" ") || "your PM";
  return { id: data.id, name, scheduling_link: null as string | null };
}

async function logConversation(supabase: any, row: Record<string, unknown>) {
  const { error } = await supabase.from("concierge_conversations").insert(row);
  if (error) console.error("concierge log failed", error);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function classify(
  text: string,
  projects: Array<{ id: string; name: string | null; project_number: string | null; properties: any }>,
): Promise<{ intent: "status" | "next_step" | "invoice" | "book_call" | "escalate"; project_id: string | null; confidence: number }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { intent: "escalate", project_id: null, confidence: 0 };

  const projectSummary = projects.map((p) => ({
    id: p.id,
    label: p.project_number || (p.properties as any)?.address || p.name || p.id,
  }));

  const prompt = `Classify this client email into one of: status, next_step, invoice, book_call, escalate.
- status: asking how a project is going / current stage.
- next_step: asking what's next / next inspection / next milestone.
- invoice: asking about balance owed / bill / payment.
- book_call: wants to schedule a call/meeting with their PM.
- escalate: ANYTHING else — general questions, how-does-X-work, complaints, document requests, anything ambiguous.

Also pick the most likely project id from this list (or null if unclear):
${JSON.stringify(projectSummary)}

Email:
"""${text.slice(0, 2000)}"""

Reply as strict JSON: {"intent":"...","project_id":"..."|null,"confidence":0..1}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("classify failed", res.status, await res.text());
      return { intent: "escalate", project_id: null, confidence: 0 };
    }
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return {
      intent: parsed.intent ?? "escalate",
      project_id: parsed.project_id ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch (e) {
    console.error("classify error", e);
    return { intent: "escalate", project_id: null, confidence: 0 };
  }
}
