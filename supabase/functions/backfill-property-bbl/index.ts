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

const SPELLED_NUMBERS: Record<string, string> = {
  FIRST: "1", SECOND: "2", THIRD: "3", FOURTH: "4", FIFTH: "5",
  SIXTH: "6", SEVENTH: "7", EIGHTH: "8", NINTH: "9", TENTH: "10",
  ELEVENTH: "11", TWELFTH: "12", THIRTEENTH: "13",
};

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

function extractStreetName(address: string): string {
  return address.trim().toUpperCase().replace(/^\d+[-\d]*\s+/, "").trim();
}

function normalizeStreet(street: string): string {
  let s = street.toUpperCase().trim();

  // Directional expansions
  s = s.replace(/\bN\.?\b/g, "NORTH");
  s = s.replace(/\bS\.?\b/g, "SOUTH");
  s = s.replace(/\bE\.?\b/g, "EAST");
  s = s.replace(/\bW\.?\b/g, "WEST");

  // Suffix normalization
  s = s.replace(/\bAVENUE\b/g, "AVE");
  s = s.replace(/\bSTREET\b/g, "ST");
  s = s.replace(/\bBOULEVARD\b/g, "BLVD");
  s = s.replace(/\bBVLD\b/g, "BLVD");
  s = s.replace(/\bDRIVE\b/g, "DR");
  s = s.replace(/\bROAD\b/g, "RD");
  s = s.replace(/\bPLACE\b/g, "PL");
  s = s.replace(/\bCOURT\b/g, "CT");
  s = s.replace(/\bLANE\b/g, "LN");
  s = s.replace(/\bTERRACE\b/g, "TER");
  s = s.replace(/\bPARKWAY\b/g, "PKWY");
  s = s.replace(/\bPLAZA\b/g, "PLZ");
  s = s.replace(/\bCIRCLE\b/g, "CIR");
  s = s.replace(/\bEXPRESSWAY\b/g, "EXPY");
  s = s.replace(/\bTURNPIKE\b/g, "TPKE");
  s = s.replace(/\bHIGHWAY\b/g, "HWY");
  s = s.replace(/\bCENTER\b/g, "CTR");
  s = s.replace(/\bCENTRE\b/g, "CTR");

  // Spelled-out numbers → digits
  for (const [word, num] of Object.entries(SPELLED_NUMBERS)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }

  // Ordinals → plain digits: "33RD" → "33"
  s = s.replace(/\b(\d+)(?:ST|ND|RD|TH)\b/g, "$1");

  // Filler words
  s = s.replace(/\bOF\s+THE\b/g, "");
  s = s.replace(/\bOF\b/g, "");

  // Collapse whitespace/punctuation
  s = s.replace(/[.,#\-\s]+/g, " ").trim();

  return s;
}

function streetNamesMatch(inputAddr: string, returnedAddr: string): boolean {
  const a = normalizeStreet(extractStreetName(inputAddr));
  const b = normalizeStreet(extractStreetName(returnedAddr));
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Core word overlap
  const aWords = a.split(" ");
  const bWords = b.split(" ");
  const aCoreSet = new Set(aWords.slice(0, -1).length > 0 ? aWords.slice(0, -1) : aWords);
  const bCoreSet = new Set(bWords.slice(0, -1).length > 0 ? bWords.slice(0, -1) : bWords);
  for (const w of aCoreSet) {
    if (bCoreSet.has(w)) return true;
  }
  return false;
}

async function verifyBBLWithPLUTO(
  boroCode: string,
  paddedBlock: string,
  paddedLot: string,
  inputAddress: string
): Promise<{ verified: boolean; owner_name?: string }> {
  try {
    const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?borocode=${boroCode}&block=${paddedBlock}&lot=${paddedLot}&$select=address,ownername&$limit=1`;
    const resp = await fetch(plutoUrl);
    if (!resp.ok) return { verified: false };
    const data = await resp.json();
    if (!data?.length) return { verified: false };
    const plutoAddress = data[0].address || "";
    const owner_name = data[0].ownername || undefined;

    if (plutoAddress && !streetNamesMatch(inputAddress, plutoAddress)) {
      console.log(`[Backfill Verify] Street mismatch: input="${normalizeStreet(extractStreetName(inputAddress))}", PLUTO="${normalizeStreet(extractStreetName(plutoAddress))}". Rejecting.`);
      return { verified: false };
    }
    return { verified: true, owner_name };
  } catch {
    return { verified: false };
  }
}

async function lookupAddress(address: string) {
  if (address.trim().length < 5) return null;

  const inputHouseMatch = address.trim().match(/^(\d+[-\d]*)/);
  const inputHouseNum = inputHouseMatch ? inputHouseMatch[1] : null;

  // Strategy 1: NYC GeoSearch → cross-verify with PLUTO
  try {
    const geoUrl = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(address)}&size=1`;
    const geoResp = await fetch(geoUrl);
    if (geoResp.ok) {
      const geoData = await geoResp.json();
      const feature = geoData?.features?.[0];
      if (feature) {
        const props = feature.properties;
        const returnedHouseNum = props?.housenumber;

        if (inputHouseNum && returnedHouseNum && inputHouseNum !== returnedHouseNum) {
          console.log(`[Backfill] House number mismatch for "${address}": input="${inputHouseNum}", returned="${returnedHouseNum}".`);
        } else {
          const geoLabel = props?.name || props?.label || "";
          if (geoLabel && !streetNamesMatch(address, geoLabel)) {
            console.log(`[Backfill] Street mismatch for "${address}": input="${normalizeStreet(extractStreetName(address))}", geo="${normalizeStreet(extractStreetName(geoLabel))}".`);
          } else {
            const pad = props?.addendum?.pad;
            const bbl = pad?.bbl || "";
            const boroCode = bbl.substring(0, 1);
            const paddedBlock = bbl.substring(1, 6);
            const paddedLot = bbl.substring(6, 10);
            const block = paddedBlock.replace(/^0+/, "") || null;
            const lot = paddedLot.replace(/^0+/, "") || null;
            const bin = pad?.bin || null;
            const borough = BOROUGH_CODES[boroCode] || props?.borough || null;
            const zip_code = props?.postalcode || null;

            const verification = await verifyBBLWithPLUTO(boroCode, paddedBlock, paddedLot, address);
            if (!verification.verified) {
              console.log(`[Backfill] BBL ${bbl} failed PLUTO verification for "${address}". Skipping.`);
            } else {
              return { bin, block, lot, borough, zip_code, owner_name: verification.owner_name || null };
            }
          }
        }
      }
    }
  } catch { /* fall through */ }

  // Strategy 2: PLUTO direct with house number verification
  const { street, boroCode } = parseAddress(address);
  if (street.length < 3) return null;
  const boroFilter = boroCode ? ` AND borocode='${boroCode}'` : "";
  const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%25${encodeURIComponent(street)}%25'${encodeURIComponent(boroFilter)}&$limit=5`;
  const response = await fetch(plutoUrl);
  if (response.ok) {
    const data = await response.json();
    if (data?.length > 0) {
      const match = inputHouseNum
        ? data.find((p: any) => {
            const plutoHouse = (p.address || "").match(/^(\d+)/)?.[1];
            return plutoHouse === inputHouseNum;
          })
        : data[0];

      if (match) {
        return {
          bin: match.bin || null, block: match.block || null, lot: match.lot || null,
          borough: BOROUGH_CODES[match.borocode] || match.borough || null,
          zip_code: match.zipcode || null, owner_name: match.ownername || null,
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
    const body = await req.json().catch(() => ({}));
    const forceOverwrite = body?.force === true;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: properties, error } = await supabase
      .from("properties")
      .select("id, address, borough, block, lot, bin, zip_code, owner_name");

    if (error) throw error;

    const results: { id: string; address: string; status: string; details?: string }[] = [];

    for (const prop of properties || []) {
      try {
        const lookupData = await lookupAddress(prop.address);
        if (lookupData) {
          const updates: Record<string, string> = {};

          if (forceOverwrite) {
            // Overwrite all fields with fresh lookup data
            if (lookupData.borough) updates.borough = lookupData.borough;
            if (lookupData.block) updates.block = lookupData.block;
            if (lookupData.lot) updates.lot = lookupData.lot;
            if (lookupData.bin) updates.bin = lookupData.bin;
            if (lookupData.zip_code) updates.zip_code = lookupData.zip_code;
            if (lookupData.owner_name) updates.owner_name = lookupData.owner_name;
          } else {
            // Only fill missing fields
            if (!prop.borough && lookupData.borough) updates.borough = lookupData.borough;
            if (!prop.block && lookupData.block) updates.block = lookupData.block;
            if (!prop.lot && lookupData.lot) updates.lot = lookupData.lot;
            if (!prop.bin && lookupData.bin) updates.bin = lookupData.bin;
            if (!prop.zip_code && lookupData.zip_code) updates.zip_code = lookupData.zip_code;
            if (!prop.owner_name && lookupData.owner_name) updates.owner_name = lookupData.owner_name;
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from("properties").update(updates).eq("id", prop.id);
            results.push({ id: prop.id, address: prop.address, status: "updated", details: JSON.stringify(updates) });
          } else {
            results.push({ id: prop.id, address: prop.address, status: "already_complete" });
          }
        } else {
          results.push({ id: prop.id, address: prop.address, status: "not_found" });
        }
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        results.push({ id: prop.id, address: prop.address, status: `error: ${e.message}` });
      }
    }

    const updated = results.filter((r) => r.status === "updated").length;
    const notFound = results.filter((r) => r.status === "not_found").length;

    return new Response(
      JSON.stringify({ total: results.length, updated, notFound, forceOverwrite, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
