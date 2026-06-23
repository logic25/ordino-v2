// Stock-photo search proxy. Queries Unsplash (primary) and Pexels (fallback)
// using server-held free API keys. Returns a normalized thumbnail list so the
// Content page can present a picker without leaking keys to the browser.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Photo = {
  id: string;
  source: "unsplash" | "pexels";
  thumb: string;
  full: string;
  photographer: string;
  photographer_url: string;
  attribution: string; // ready-to-paste markdown credit line
  alt: string;
};

async function searchUnsplash(q: string): Promise<Photo[]> {
  const key = Deno.env.get("UNSPLASH_ACCESS_KEY");
  if (!key) return [];
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=9&orientation=landscape`;
  const r = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.results || []).map((p: any): Photo => ({
    id: `u_${p.id}`,
    source: "unsplash",
    thumb: p.urls?.small,
    full: p.urls?.regular,
    photographer: p.user?.name || "Unsplash photographer",
    photographer_url: `${p.user?.links?.html || "https://unsplash.com"}?utm_source=ordino&utm_medium=referral`,
    attribution: `Photo by [${p.user?.name}](${p.user?.links?.html || "https://unsplash.com"}?utm_source=ordino&utm_medium=referral) on [Unsplash](https://unsplash.com?utm_source=ordino&utm_medium=referral)`,
    alt: p.alt_description || q,
  }));
}

async function searchPexels(q: string): Promise<Photo[]> {
  const key = Deno.env.get("PEXELS_API_KEY");
  if (!key) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=9&orientation=landscape`;
  const r = await fetch(url, { headers: { Authorization: key } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.photos || []).map((p: any): Photo => ({
    id: `p_${p.id}`,
    source: "pexels",
    thumb: p.src?.medium,
    full: p.src?.large,
    photographer: p.photographer || "Pexels photographer",
    photographer_url: p.photographer_url,
    attribution: `Photo by [${p.photographer}](${p.photographer_url}) on [Pexels](https://www.pexels.com)`,
    alt: p.alt || q,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return new Response(JSON.stringify({ photos: [], warning: "missing query" }), { headers: { ...cors, "Content-Type": "application/json" } });

    const [unsplash, pexels] = await Promise.all([searchUnsplash(q), searchPexels(q)]);
    const photos = [...unsplash, ...pexels];
    const warning =
      !Deno.env.get("UNSPLASH_ACCESS_KEY") && !Deno.env.get("PEXELS_API_KEY")
        ? "No stock-photo API keys configured. Add UNSPLASH_ACCESS_KEY or PEXELS_API_KEY in project secrets."
        : photos.length === 0
        ? "No photos found for that query."
        : undefined;

    return new Response(JSON.stringify({ photos, warning }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ photos: [], error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
