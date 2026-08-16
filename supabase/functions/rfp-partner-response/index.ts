import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isRateLimited } from "../_shared/timingSafeEqual.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Response links are single-use and time-limited. An outreach older than this
// can no longer be answered via the emailed link (the partner would need a fresh
// outreach). Guards against stale/leaked tokens being replayed months later.
const RESPONSE_TTL_DAYS = 30;

function htmlPage(inner: string, status = 200): Response {
  return new Response(
    `<html><body style="font-family:Arial,sans-serif;text-align:center;padding:60px;max-width:520px;margin:0 auto;">${inner}</body></html>`,
    { headers: { ...corsHeaders, "Content-Type": "text/html" }, status }
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only GET (render a confirmation page) and POST (commit the response) are
  // supported. A bare GET NEVER mutates state — this is what stops mail-security
  // prefetchers (SafeLinks/Proofpoint) and browser link-prefetch from recording
  // a response the partner never chose. The commit happens only on the explicit
  // POST from the confirmation form below.
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const response = url.searchParams.get("response"); // "interested" or "passed"

    if (!token || !response || !["interested", "passed"].includes(response)) {
      return htmlPage(
        `<h2>Invalid Link</h2><p>This link is invalid or has expired.</p>`,
        400
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Per-IP rate limit — the token is unguessable, but this caps brute-force /
    // abusive replay against the endpoint. Applied to both GET and POST.
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";
    if (await isRateLimited(supabase, `rfp-partner-response:${clientIp}`, 20, 60)) {
      return htmlPage(
        `<h2>Too many requests</h2><p>Please wait a moment and try again.</p>`,
        429
      );
    }

    // Find the outreach record by response_token
    const { data: outreach, error: findError } = await supabase
      .from("rfp_partner_outreach")
      .select("id, response_status, responded_at, notified_at, partner_client_id, discovered_rfp_id")
      .eq("response_token", token)
      .maybeSingle();

    if (findError || !outreach) {
      return htmlPage(
        `<h2>Link Not Found</h2><p>This response link was not found.</p>`,
        404
      );
    }

    // Expiry: token is only valid for RESPONSE_TTL_DAYS after the outreach was sent.
    const sentAt = outreach.notified_at ? new Date(outreach.notified_at).getTime() : 0;
    const ageMs = Date.now() - sentAt;
    if (!sentAt || ageMs > RESPONSE_TTL_DAYS * 24 * 60 * 60 * 1000) {
      return htmlPage(
        `<h2>Link Expired</h2><p>This response link has expired. Please contact us directly if you're still interested.</p>`,
        410
      );
    }

    // One-time use: once a response has been recorded, the token is spent.
    if (outreach.response_status && outreach.response_status !== "pending") {
      const prev = outreach.response_status === "interested" ? "interest" : "that you passed";
      return htmlPage(
        `<h2>Already Recorded</h2><p>We already have your response (${escapeHtml(prev)}) on file. Thanks!</p>`
      );
    }

    const label = response === "interested" ? "Interested" : "Not interested";

    // GET → render a confirmation interstitial. No state change. The partner must
    // explicitly click "Confirm", which POSTs back to this same URL.
    if (req.method === "GET") {
      const action = escapeHtml(`${url.pathname}?token=${encodeURIComponent(token)}&response=${encodeURIComponent(response)}`);
      return htmlPage(
        `<h2>Confirm your response</h2>
         <p style="color:#555;line-height:1.6;">You're about to respond: <strong>${escapeHtml(label)}</strong>.</p>
         <form method="POST" action="${action}" style="margin-top:24px;">
           <button type="submit" style="background:#1e293b;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Confirm: ${escapeHtml(label)}</button>
         </form>
         <p style="color:#94a3b8;font-size:12px;margin-top:20px;">Nothing is recorded until you click Confirm.</p>`
      );
    }

    // POST → commit. Atomic one-time-use: the update only lands while the row is
    // still 'pending', so a double-submit / race can record at most one response.
    const { data: updated, error: updateError } = await supabase
      .from("rfp_partner_outreach")
      .update({
        response_status: response,
        responded_at: new Date().toISOString(),
      })
      .eq("id", outreach.id)
      .eq("response_status", "pending")
      .select("id");

    if (updateError) throw updateError;

    if (!updated || updated.length === 0) {
      // Lost the race — someone already responded between our read and write.
      return htmlPage(
        `<h2>Already Recorded</h2><p>We already have your response on file. Thanks!</p>`
      );
    }

    const emoji = response === "interested" ? "🎉" : "👋";
    const message = response === "interested"
      ? "Thank you for your interest! The team will be in touch shortly to discuss next steps."
      : "Thank you for letting us know. We'll keep you in mind for future opportunities.";

    return htmlPage(
      `<div style="font-size:48px;margin-bottom:16px;">${emoji}</div>
       <h2 style="color:#1a1a1a;">Response Received</h2>
       <p style="color:#555;line-height:1.6;">${message}</p>`
    );
  } catch (err) {
    console.error("Error:", err);
    return htmlPage(
      `<h2>Something went wrong</h2><p>Please try again later.</p>`,
      500
    );
  }
});
