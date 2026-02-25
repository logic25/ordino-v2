import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { billing_request_id, recipient_email, recipient_name, project, services, total_price } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build the email body matching legacy format
    const serviceLines = (services || []).map((s: any) =>
      `${s.name}\n` +
      (s.sub_services ? `Sub services: ${s.sub_services}\n` : "") +
      (s.description ? `Notation: ${s.description}\n` : "") +
      `Price: $${Number(s.price).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
      `Billed by: ${s.billed_by || "—"}\n` +
      (s.billed_to_contact ? `Billed to contact: ${s.billed_to_contact}\n` : "")
    ).join("\n");

    const projectRef = project
      ? `Project #${project.number || "—"} – ${project.address || project.name || "—"} – ${project.permit || "—"}`
      : "—";

    const subject = `${projectRef} - Billing notification`;

    const totalFormatted = `$${Number(total_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 20px;">
  <p>Hello ${recipient_name || "there"},</p>
  <p>The following has been billed on this project:</p>
  <div style="white-space: pre-wrap; margin: 16px 0; padding: 12px; background: #f9f9f9; border-radius: 6px;">${serviceLines}</div>
  <p><strong>Total price: ${totalFormatted}</strong></p>
  ${project?.id ? `<p><a href="${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "")}/projects/${project.id}" style="display: inline-block; padding: 10px 20px; background: #333; color: #fff; text-decoration: none; border-radius: 6px;">View Project Services</a></p>` : ""}
  <p>Thanks,<br/>Green Light Expediting</p>
</body>
</html>`.trim();

    // Send via gmail-send function
    const { error } = await supabase.functions.invoke("gmail-send", {
      body: {
        to: recipient_email,
        subject,
        html_body: htmlBody,
      },
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
