// scan-business-card: photo of a business card (or badge) -> structured contact.
// JWT-authenticated. Vision extraction via the Lovable AI Gateway.
// Used by /bd/capture — the in-house Popl replacement for event lead capture.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

  // Auth: any signed-in company member.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: { image_base64?: string; mime?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const image = (body.image_base64 ?? "").replace(/^data:[^,]+,/, "");
  const mime = body.mime || "image/jpeg";
  if (!image) return json({ error: "image_base64 required" }, 400);
  // ~6MB base64 cap (≈4.5MB image) — plenty for a card photo, guards the gateway.
  if (image.length > 6_000_000) return json({ error: "Image too large — retake closer/cropped" }, 413);

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You extract contact info from photos of business cards or event badges. " +
            "Return ONLY what is visibly printed — never invent or guess missing fields. " +
            "If the image is not a business card/badge or is unreadable, set readable=false.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the contact details from this card." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${image}` } },
          ],
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "card_contact",
          description: "The contact details printed on the card",
          parameters: {
            type: "object",
            required: ["readable"],
            properties: {
              readable: { type: "boolean" },
              full_name: { type: "string" },
              company: { type: "string" },
              role: { type: "string", description: "Job title as printed" },
              email: { type: "string" },
              phone: { type: "string" },
              website: { type: "string" },
              address: { type: "string" },
            },
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "card_contact" } },
    }),
  });

  if (!aiRes.ok) {
    const txt = await aiRes.text().catch(() => "");
    console.error("gateway", aiRes.status, txt.slice(0, 300));
    if (aiRes.status === 429) return json({ error: "Rate limited — try again in a moment" }, 429);
    return json({ error: `Vision extraction failed (${aiRes.status})` }, 502);
  }
  const aiJson = await aiRes.json();
  const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  let contact: Record<string, unknown> = {};
  try { contact = JSON.parse(call?.function?.arguments ?? "{}"); } catch { /* fall through */ }

  return json({ contact });
});
