import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isRateLimited } from "../_shared/timingSafeEqual.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlPage(title: string, message: string, status: number, emoji = ""): Response {
  return new Response(
    `<html><body style="font-family:Arial,sans-serif;text-align:center;padding:60px;max-width:500px;margin:0 auto;">
      ${emoji ? `<div style="font-size:48px;margin-bottom:16px;">${emoji}</div>` : ""}
      <h2 style="color:#1a1a1a;">${title}</h2>
      <p style="color:#555;line-height:1.6;">${message}</p>
    </body></html>`,
    { headers: { ...corsHeaders, "Content-Type": "text/html" }, status },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Per-IP rate limit (persistent, survives cold starts) — this is an
  // unauthenticated public endpoint, so cap abusive token-guessing / replay.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (await isRateLimited(supabase, `rfp-partner-response:${clientIp}`, 10, 60)) {
    return htmlPage("Too Many Requests", "Please wait a moment and try again.", 429);
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const response = url.searchParams.get("response"); // "interested" or "passed"

    if (!token || token.length < 16 || !response || !["interested", "passed"].includes(response)) {
      return htmlPage("Invalid Link", "This link is invalid or has expired.", 400);
    }

    // Find the outreach record by response_token
    const { data: outreach, error: findError } = await supabase
      .from("rfp_partner_outreach")
      .select("id, response_status, responded_at, token_expires_at, partner_client_id, discovered_rfp_id")
      .eq("response_token", token)
      .maybeSingle();

    if (findError || !outreach) {
      return htmlPage("Link Not Found", "This response link was not found or has already been used.", 404);
    }

    // Expiry guard
    if (outreach.token_expires_at && new Date(outreach.token_expires_at).getTime() < Date.now()) {
      return htmlPage(
        "Link Expired",
        "This response link has expired. Please reach out to us directly and we'll be happy to help.",
        410,
      );
    }

    // Single-use guard: once a partner has responded, the token is spent.
    if (outreach.response_status !== "pending" || outreach.responded_at) {
      return htmlPage(
        "Already Recorded",
        "We've already recorded your response to this opportunity. Thank you!",
        409,
        "✅",
      );
    }

    // Atomic single-use update: the extra response_status = 'pending' predicate
    // means only the first of two concurrent clicks wins the race.
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

    // Lost the race (another request already recorded a response).
    if (!updated || updated.length === 0) {
      return htmlPage(
        "Already Recorded",
        "We've already recorded your response to this opportunity. Thank you!",
        409,
        "✅",
      );
    }

    const emoji = response === "interested" ? "🎉" : "👋";
    const message = response === "interested"
      ? "Thank you for your interest! The team will be in touch shortly to discuss next steps."
      : "Thank you for letting us know. We'll keep you in mind for future opportunities.";

    return htmlPage("Response Received", message, 200, emoji);
  } catch (err) {
    console.error("Error:", err);
    return htmlPage("Something went wrong", "Please try again later.", 500);
  }
});
