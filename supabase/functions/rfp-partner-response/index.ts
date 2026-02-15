import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const response = url.searchParams.get("response"); // "interested" or "passed"

    if (!token || !response || !["interested", "passed"].includes(response)) {
      // Return a simple HTML page for invalid requests
      return new Response(
        `<html><body style="font-family:Arial;text-align:center;padding:60px;"><h2>Invalid Link</h2><p>This link is invalid or has expired.</p></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the outreach record by response_token
    const { data: outreach, error: findError } = await supabase
      .from("rfp_partner_outreach")
      .select("id, response_status, partner_client_id, discovered_rfp_id")
      .eq("response_token", token)
      .maybeSingle();

    if (findError || !outreach) {
      return new Response(
        `<html><body style="font-family:Arial;text-align:center;padding:60px;"><h2>Link Not Found</h2><p>This response link was not found or has already been used.</p></body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 404 }
      );
    }

    // Update the response
    const { error: updateError } = await supabase
      .from("rfp_partner_outreach")
      .update({
        response_status: response,
        responded_at: new Date().toISOString(),
      })
      .eq("id", outreach.id);

    if (updateError) throw updateError;

    const emoji = response === "interested" ? "🎉" : "👋";
    const message = response === "interested"
      ? "Thank you for your interest! The team will be in touch shortly to discuss next steps."
      : "Thank you for letting us know. We'll keep you in mind for future opportunities.";

    return new Response(
      `<html>
        <body style="font-family:Arial,sans-serif;text-align:center;padding:60px;max-width:500px;margin:0 auto;">
          <div style="font-size:48px;margin-bottom:16px;">${emoji}</div>
          <h2 style="color:#1a1a1a;">Response Received</h2>
          <p style="color:#555;line-height:1.6;">${message}</p>
        </body>
      </html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      `<html><body style="font-family:Arial;text-align:center;padding:60px;"><h2>Something went wrong</h2><p>Please try again later.</p></body></html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 500 }
    );
  }
});
