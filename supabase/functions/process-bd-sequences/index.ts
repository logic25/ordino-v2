// BD Sequence sender cron.
// Trigger: POST with header x-cron-secret: <CRON_SECRET>
// Per owner: enforce 25/day cap, atomically claim ONE due ACTIVE enrollment,
// pause-on-reply (block + notify if any inbound bd_activities EMAIL after enrollment.created_at),
// otherwise send the current step via gmail-send (service-role + user_id=owner),
// log a bd_activities EMAIL row, advance current_step / schedule next_send_at, release claim.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DAILY_CAP = 25;

function tomorrow9am(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  // 09:00 America/New_York is roughly 13:00 UTC (EST) or 14:00 UTC (EDT).
  // Approximate as 13:00 UTC — good enough for a soft overflow window.
  d.setUTCHours(13, 0, 0, 0);
  return d.toISOString();
}

function renderTemplate(tpl: string | null, vars: Record<string, string>): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const ownerFilter = url.searchParams.get("owner"); // optional: test a single owner
  const maxAttempts = Number(url.searchParams.get("max") || "50");

  // Find owners with at least one due ACTIVE enrollment.
  let ownerQ = admin
    .from("bd_sequence_enrollments")
    .select("created_by")
    .eq("status", "ACTIVE")
    .is("sending_started_at", null)
    .not("created_by", "is", null)
    .lte("next_send_at", new Date().toISOString());
  if (ownerFilter) ownerQ = ownerQ.eq("created_by", ownerFilter);
  const { data: ownerRows, error: ownerErr } = await ownerQ;
  if (ownerErr) {
    return new Response(JSON.stringify({ error: ownerErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const owners = Array.from(new Set((ownerRows || []).map((r: any) => r.created_by)));

  const results: any[] = [];

  for (const ownerId of owners) {
    // Daily cap: count outbound sequence emails for this owner today (UTC).
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const { count: sentToday } = await admin
      .from("bd_activities")
      .select("id", { count: "exact", head: true })
      .eq("created_by", ownerId)
      .eq("type", "EMAIL")
      .gte("created_at", dayStart.toISOString())
      .not("metadata->>sequence_enrollment_id", "is", null);

    let remaining = Math.max(0, DAILY_CAP - (sentToday || 0));
    let attempts = 0;

    while (remaining > 0 && attempts < maxAttempts) {
      attempts++;

      // Atomic claim — RETURNING ensures another worker that races us gets 0 rows.
      const { data: claimed, error: claimErr } = await admin
        .rpc("claim_bd_sequence_enrollment", { _owner: ownerId });
      if (claimErr) { results.push({ ownerId, error: claimErr.message }); break; }
      if (!claimed || claimed.length === 0) break; // nothing left to claim

      const enr = claimed[0];

      try {
        // PAUSE-ON-REPLY (blocking): any inbound EMAIL on this lead after enrollment was created.
        const { data: replies } = await admin
          .from("bd_activities")
          .select("id")
          .eq("lead_id", enr.lead_id)
          .eq("type", "EMAIL")
          .eq("metadata->>direction", "inbound")
          .gt("created_at", enr.created_at)
          .limit(1);

        if (replies && replies.length > 0) {
          await admin.from("bd_sequence_enrollments").update({
            status: "PAUSED",
            paused_reason: "inbound_reply",
            sending_started_at: null,
          }).eq("id", enr.id);

          await admin.from("notifications").insert({
            user_id: ownerId,
            company_id: enr.company_id,
            type: "sequence_paused",
            title: "Sequence paused — lead replied",
            message: `Stopped sending to the lead after an inbound reply.`,
            metadata: { enrollment_id: enr.id, lead_id: enr.lead_id, sequence_id: enr.sequence_id },
          } as any);

          results.push({ ownerId, enrollment_id: enr.id, action: "paused_on_reply" });
          continue;
        }

        // Resolve next step (current_step is the LAST sent; next = current_step + 1; first send = 1).
        const nextStepNumber = (enr.current_step || 0) + 1;
        const { data: step } = await admin
          .from("bd_sequence_steps")
          .select("*")
          .eq("sequence_id", enr.sequence_id)
          .eq("step_number", nextStepNumber)
          .maybeSingle();

        if (!step) {
          // No more steps — complete.
          await admin.from("bd_sequence_enrollments").update({
            status: "COMPLETED", sending_started_at: null,
          }).eq("id", enr.id);
          results.push({ ownerId, enrollment_id: enr.id, action: "completed" });
          continue;
        }

        // Load lead.
        const { data: lead } = await admin
          .from("leads")
          .select("id, full_name, contact_email, company")
          .eq("id", enr.lead_id)
          .maybeSingle();

        if (!lead?.contact_email) {
          await admin.from("bd_sequence_enrollments").update({
            status: "EXITED", paused_reason: "no_contact_email", sending_started_at: null,
          }).eq("id", enr.id);
          results.push({ ownerId, enrollment_id: enr.id, action: "exited_no_email" });
          continue;
        }

        const vars = {
          first_name: (lead.full_name || "").split(" ")[0] || "there",
          full_name: lead.full_name || "",
          company: lead.company || "",
        };
        const subject = renderTemplate(step.subject, vars) || "Following up";
        const bodyText = renderTemplate(step.body_template, vars);
        const htmlBody = bodyText
          .split(/\n{2,}/)
          .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("");

        // Send via gmail-send (service-role; user_id = owner). This is the SAME in-process
        // sender helper used by the app — not a public "send as anyone" endpoint.
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: ownerId,
            to: lead.contact_email,
            subject,
            html_body: htmlBody,
          }),
        });
        const sendJson = await sendRes.json();

        if (!sendRes.ok || sendJson.error) {
          await admin.from("bd_sequence_enrollments").update({
            sending_started_at: null,
            next_send_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // retry in 1h
          }).eq("id", enr.id);
          results.push({
            ownerId, enrollment_id: enr.id, action: "send_failed",
            error: sendJson.error || `HTTP ${sendRes.status}`,
          });
          continue;
        }

        // Log outbound bd_activity with sequence metadata (used for cap + pause logic).
        await admin.from("bd_activities").insert({
          company_id: enr.company_id,
          lead_id: enr.lead_id,
          type: "EMAIL",
          content: `${subject}\n\n${bodyText.slice(0, 280)}`,
          metadata: {
            email_id: sendJson.message_id,
            thread_id: sendJson.thread_id,
            direction: "outbound",
            subject,
            sequence_enrollment_id: enr.id,
            sequence_id: enr.sequence_id,
            step_number: step.step_number,
          },
          created_by: ownerId,
        } as any);

        // Schedule next step or complete.
        const { data: nextStep } = await admin
          .from("bd_sequence_steps")
          .select("day_offset")
          .eq("sequence_id", enr.sequence_id)
          .eq("step_number", nextStepNumber + 1)
          .maybeSingle();

        if (nextStep) {
          const prevOffset = step.day_offset || 0;
          const deltaDays = Math.max(0, (nextStep.day_offset || 0) - prevOffset);
          const nextAt = new Date(Date.now() + deltaDays * 24 * 60 * 60 * 1000).toISOString();
          await admin.from("bd_sequence_enrollments").update({
            current_step: nextStepNumber,
            last_sent_at: new Date().toISOString(),
            next_send_at: nextAt,
            sending_started_at: null,
          }).eq("id", enr.id);
        } else {
          await admin.from("bd_sequence_enrollments").update({
            current_step: nextStepNumber,
            last_sent_at: new Date().toISOString(),
            status: "COMPLETED",
            sending_started_at: null,
          }).eq("id", enr.id);
        }

        remaining--;
        results.push({
          ownerId, enrollment_id: enr.id, action: "sent",
          message_id: sendJson.message_id, step_number: step.step_number,
        });
      } catch (e) {
        await admin.from("bd_sequence_enrollments").update({
          sending_started_at: null,
          next_send_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }).eq("id", enr.id);
        results.push({ ownerId, enrollment_id: enr.id, action: "error", error: String((e as Error).message) });
      }
    }

    // If owner hit the cap and still has more queued today, overflow to tomorrow 09:00.
    if (remaining <= 0) {
      const tom = tomorrow9am();
      await admin
        .from("bd_sequence_enrollments")
        .update({ next_send_at: tom })
        .eq("created_by", ownerId)
        .eq("status", "ACTIVE")
        .is("sending_started_at", null)
        .lte("next_send_at", new Date().toISOString());
      results.push({ ownerId, action: "cap_hit_requeued_tomorrow", at: tom });
    }
  }

  return new Response(JSON.stringify({ ok: true, owners: owners.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
