import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOROUGH_CODES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

const BOROUGH_NAME_TO_CODE: Record<string, string> = {
  manhattan: "1",
  bronx: "2",
  "the bronx": "2",
  brooklyn: "3",
  queens: "4",
  "staten island": "5",
};

const STRIP_PATTERNS = [
  /,?\s*(new\s*york|nyc|ny|manhattan|bronx|the\s+bronx|brooklyn|queens|staten\s*island)\s*(,?\s*(ny|new\s*york))?\s*\d{0,5}\s*$/i,
  /,?\s*(ny|new\s*york)\s*\d{0,5}\s*$/i,
  /\s+\d{5}(-\d{4})?\s*$/,
];

function parseAddress(raw: string): { street: string; boroCode: string | null } {
  let detectedBoroCode: string | null = null;
  for (const [name, code] of Object.entries(BOROUGH_NAME_TO_CODE)) {
    const regex = new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(raw)) {
      detectedBoroCode = code;
      break;
    }
  }

  let street = raw.trim().toUpperCase();
  for (const pattern of STRIP_PATTERNS) {
    street = street.replace(pattern, "");
  }
  street = street.replace(/[,\s]+$/, "").trim();

  return { street, boroCode: detectedBoroCode };
}

async function lookupAddress(address: string) {
  if (address.trim().length < 5) return null;

  // Strategy 1: NYC GeoSearch API (most reliable)
  try {
    const geoUrl = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(address)}&size=1`;
    const geoResp = await fetch(geoUrl);
    if (geoResp.ok) {
      const geoData = await geoResp.json();
      const feature = geoData?.features?.[0];
      if (feature) {
        const props = feature.properties;
        const pad = props?.addendum?.pad;
        const bbl = pad?.bbl || "";
        const boroCode = bbl.substring(0, 1);
        const block = bbl.substring(1, 6).replace(/^0+/, "") || null;
        const lot = bbl.substring(6, 10).replace(/^0+/, "") || null;
        const bin = pad?.bin || null;
        const borough = BOROUGH_CODES[boroCode] || props?.borough || null;
        const zip_code = props?.postalcode || null;

        // Enrich with PLUTO for owner name
        let owner_name: string | null = null;
        if (bbl) {
          try {
            const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?borocode=${boroCode}&block=${bbl.substring(1, 6)}&lot=${bbl.substring(6, 10)}&$select=ownername&$limit=1`;
            const plutoResp = await fetch(plutoUrl);
            if (plutoResp.ok) {
              const plutoData = await plutoResp.json();
              if (plutoData?.[0]?.ownername) owner_name = plutoData[0].ownername;
            }
          } catch { /* optional */ }
        }

        return { bin, block, lot, borough, zip_code, owner_name };
      }
    }
  } catch { /* fall through to PLUTO */ }

  // Strategy 2: PLUTO direct (fallback)
  const { street, boroCode } = parseAddress(address);
  if (street.length < 3) return null;
  const boroFilter = boroCode ? ` AND borocode='${boroCode}'` : "";
  const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%25${encodeURIComponent(street)}%25'${encodeURIComponent(boroFilter)}&$limit=5`;
  const response = await fetch(plutoUrl);
  if (response.ok) {
    const data = await response.json();
    if (data?.length > 0) {
      const p = data[0];
      return {
        bin: p.bin || null, block: p.block || null, lot: p.lot || null,
        borough: BOROUGH_CODES[p.borocode] || p.borough || null,
        zip_code: p.zipcode || null, owner_name: p.ownername || null,
      };
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch ALL properties to ensure complete data
    const { data: properties, error } = await supabase
      .from("properties")
      .select("id, address, borough, block, lot, bin, zip_code, owner_name");

    if (error) throw error;

    const results: { id: string; address: string; status: string }[] = [];

    for (const prop of properties || []) {
      try {
        const lookupData = await lookupAddress(prop.address);
        if (lookupData) {
          const updates: Record<string, string> = {};
          // Fill any missing field, even if some fields already have data
          if (!prop.borough && lookupData.borough) updates.borough = lookupData.borough;
          if (!prop.block && lookupData.block) updates.block = lookupData.block;
          if (!prop.lot && lookupData.lot) updates.lot = lookupData.lot;
          if (!prop.bin && lookupData.bin) updates.bin = lookupData.bin;
          if (!prop.zip_code && lookupData.zip_code) updates.zip_code = lookupData.zip_code;
          if (!prop.owner_name && lookupData.owner_name) updates.owner_name = lookupData.owner_name;

          if (Object.keys(updates).length > 0) {
            await supabase.from("properties").update(updates).eq("id", prop.id);
            results.push({ id: prop.id, address: prop.address, status: "updated" });
          } else {
            results.push({ id: prop.id, address: prop.address, status: "already_complete" });
          }
        } else {
          results.push({ id: prop.id, address: prop.address, status: "not_found" });
        }
        // Rate limit: small delay between lookups
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        results.push({ id: prop.id, address: prop.address, status: `error: ${e.message}` });
      }
    }

    const updated = results.filter((r) => r.status === "updated").length;
    const notFound = results.filter((r) => r.status === "not_found").length;

    return new Response(
      JSON.stringify({ total: results.length, updated, notFound, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
