// Given a blog title + body, return a short (2-5 word) stock-photo search
// phrase that will surface a visually relevant, high-conversion cover image.
// Uses Lovable AI (no key needed by the caller — LOVABLE_API_KEY is server-held).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { title = "", body = "", topics = [] } = await req.json().catch(() => ({}));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ query: title || "construction" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const excerpt = String(body).replace(/!\[[^\]]*\]\([^)]+\)/g, "").slice(0, 1500);
    const prompt = `You pick stock photos that boost conversion on B2B construction/permit-expediting blog posts.

Title: ${title}
Topics: ${(topics || []).join(", ")}
Excerpt: ${excerpt}

Return ONLY a 2-4 word stock-photo search phrase describing a concrete, photographable scene that fits the post and would make a reader click. Prefer real-world nouns (construction site, blueprint desk, NYC skyline, hard hat inspector) over acronyms or abstract jargon (never return "PAA", "ALT-1", "DOB"). No quotes, no punctuation, no explanation.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ query: title || "construction" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content?.toString().trim() || "";
    const query = raw.replace(/^["'`]+|["'`.]+$/g, "").split("\n")[0].slice(0, 60) || title || "construction";
    return new Response(JSON.stringify({ query }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ query: "construction", error: String(e) }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
