import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  const { street, boroCode } = parseAddress(address);
  if (street.length < 3) return null;

  const boroFilter = boroCode ? ` AND borocode='${boroCode}'` : "";

  // Strategy 1: PLUTO
  const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%25${encodeURIComponent(street)}%25'${encodeURIComponent(boroFilter)}&$limit=5`;
  const response = await fetch(plutoUrl);
  if (response.ok) {
    const data = await response.json();
    if (data?.length > 0) {
      const p = data[0];
      return {
        bin: p.bin || null,
        block: p.block || null,
        lot: p.lot || null,
        borough: BOROUGH_CODES[p.borocode] || p.borough || null,
        zip_code: p.zipcode || null,
        owner_name: p.ownername || null,
      };
    }
  }

  // Strategy 2: PAD
  const houseMatch = street.match(/^(\d+[-\d]*)\s+(.+)$/);
  if (houseMatch) {
    const houseNum = houseMatch[1];
    const streetName = houseMatch[2];
    const padBoroFilter = boroCode ? ` AND boro='${boroCode}'` : "";
    const padUrl = `https://data.cityofnewyork.us/resource/bc93-7baw.json?$where=lhnd='${encodeURIComponent(houseNum)}' AND upper(stname) like '%25${encodeURIComponent(streetName.substring(0, 20))}%25'${encodeURIComponent(padBoroFilter)}&$limit=5`;
    const padResponse = await fetch(padUrl);
    if (padResponse.ok) {
      const padData = await padResponse.json();
      if (padData?.length > 0) {
        const p = padData[0];
        return {
          bin: p.bin || null,
          block: p.block || null,
          lot: p.lot || null,
          borough: BOROUGH_CODES[p.boro] || null,
          zip_code: p.zipcode || null,
          owner_name: null,
        };
      }
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

    // Fetch properties missing BBL data
    const { data: properties, error } = await supabase
      .from("properties")
      .select("id, address, borough, block, lot")
      .or("borough.is.null,block.is.null,lot.is.null");

    if (error) throw error;

    const results: { id: string; address: string; status: string }[] = [];

    for (const prop of properties || []) {
      try {
        const lookupData = await lookupAddress(prop.address);
        if (lookupData) {
          const updates: Record<string, string> = {};
          if (!prop.borough && lookupData.borough) updates.borough = lookupData.borough;
          if (!prop.block && lookupData.block) updates.block = lookupData.block;
          if (!prop.lot && lookupData.lot) updates.lot = lookupData.lot;
          if (lookupData.bin) updates.bin = lookupData.bin;
          if (lookupData.zip_code) updates.zip_code = lookupData.zip_code;
          if (lookupData.owner_name) updates.owner_name = lookupData.owner_name;

          if (Object.keys(updates).length > 0) {
            await supabase.from("properties").update(updates).eq("id", prop.id);
            results.push({ id: prop.id, address: prop.address, status: "updated" });
          } else {
            results.push({ id: prop.id, address: prop.address, status: "no_new_data" });
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
