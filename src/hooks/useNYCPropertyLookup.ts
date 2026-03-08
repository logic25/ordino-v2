import { useState } from "react";

export interface NYCPropertyData {
  bin?: string;
  block?: string;
  lot?: string;
  borough?: string;
  zip_code?: string;
  owner_name?: string;
  address?: string;
  aka_addresses?: string[];
}

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

/** Remove house number from address: "1136 OGDEN AVE" → "OGDEN AVE" */
function extractStreetName(address: string): string {
  return address.trim().toUpperCase().replace(/^\d+[-\d]*\s+/, "").trim();
}

/**
 * Aggressively normalize a street name for comparison.
 * Handles: suffixes, ordinals, spelled numbers, directionals, common typos.
 */
function normalizeStreet(street: string): string {
  let s = street.toUpperCase().trim();

  s = s.replace(/\bN\.?\b/g, "NORTH");
  s = s.replace(/\bS\.?\b/g, "SOUTH");
  s = s.replace(/\bE\.?\b/g, "EAST");
  s = s.replace(/\bW\.?\b/g, "WEST");

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

  for (const [word, num] of Object.entries(SPELLED_NUMBERS)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }

  s = s.replace(/\b(\d+)(?:ST|ND|RD|TH)\b/g, "$1");

  s = s.replace(/\bOF\s+THE\b/g, "");
  s = s.replace(/\bOF\b/g, "");

  s = s.replace(/[.,#\-\s]+/g, " ").trim();

  return s;
}

/** Check if two addresses refer to the same street */
function streetNamesMatch(inputAddr: string, returnedAddr: string): boolean {
  const a = normalizeStreet(extractStreetName(inputAddr));
  const b = normalizeStreet(extractStreetName(returnedAddr));
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aWords = a.split(" ");
  const bWords = b.split(" ");
  const aCoreSet = new Set(aWords.slice(0, -1).length > 0 ? aWords.slice(0, -1) : aWords);
  const bCoreSet = new Set(bWords.slice(0, -1).length > 0 ? bWords.slice(0, -1) : bWords);
  for (const w of aCoreSet) {
    if (bCoreSet.has(w)) return true;
  }
  return false;
}

/** Cross-verify GeoSearch BBL against PLUTO */
async function verifyBBLWithPLUTO(
  boroCode: string,
  paddedBlock: string,
  paddedLot: string,
  inputAddress: string
): Promise<{ verified: boolean; owner_name?: string; plutoAddress?: string }> {
  try {
    const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?borocode=${boroCode}&block=${paddedBlock}&lot=${paddedLot}&$select=address,ownername&$limit=1`;
    const resp = await fetch(plutoUrl);
    if (!resp.ok) return { verified: false };
    const data = await resp.json();
    if (!data?.length) {
      return { verified: false };
    }
    const plutoAddress = data[0].address || "";
    const owner_name = data[0].ownername || undefined;

    if (plutoAddress && !streetNamesMatch(inputAddress, plutoAddress)) {
      return { verified: false, plutoAddress };
    }

    return { verified: true, owner_name, plutoAddress };
  } catch {
    return { verified: false };
  }
}

/** Fetch AKA addresses from NYC PAD dataset using BIN */
async function fetchAkaAddresses(bin: string | undefined): Promise<string[]> {
  if (!bin) return [];
  try {
    const padUrl = `https://data.cityofnewyork.us/resource/bc8t-ecyu.json?bin=${bin}&$select=stname,lhnd,hhnd&$limit=50`;
    const resp = await fetch(padUrl);
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!data?.length) return [];
    const seen = new Set<string>();
    const akas: string[] = [];
    for (const row of data) {
      const street = (row.stname || "").trim();
      if (!street) continue;
      const low = (row.lhnd || "").trim();
      const high = (row.hhnd || "").trim();
      const label = low && high && low !== high
        ? `${low}-${high} ${street}`
        : low
        ? `${low} ${street}`
        : street;
      const key = label.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        akas.push(label.toUpperCase());
      }
    }
    return akas;
  } catch {
    return [];
  }
}

export function useNYCPropertyLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupByAddress = async (address: string): Promise<NYCPropertyData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (address.trim().length < 5) {
        setError("Address too short for lookup");
        return null;
      }

      const inputHouseMatch = address.trim().match(/^(\d+[-\d]*)/);
      const inputHouseNum = inputHouseMatch ? inputHouseMatch[1] : null;

      // Strategy 1: NYC GeoSearch → cross-verify with PLUTO
      try {
        const geoUrl = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(address)}&size=1`;
        const geoResponse = await fetch(geoUrl);
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          const feature = geoData?.features?.[0];
          if (feature) {
            const props = feature.properties;
            const returnedHouseNum = props?.housenumber;

            if (inputHouseNum && returnedHouseNum && inputHouseNum !== returnedHouseNum) {
              // House number mismatch — skip
            } else {
              const geoLabel = props?.name || props?.label || "";
              if (geoLabel && !streetNamesMatch(address, geoLabel)) {
                // Street mismatch — skip
              } else {
                const pad = props?.addendum?.pad;
                const bbl = pad?.bbl || "";
                const boroCode = bbl.substring(0, 1);
                const paddedBlock = bbl.substring(1, 6);
                const paddedLot = bbl.substring(6, 10);
                const block = paddedBlock.replace(/^0+/, "");
                const lot = paddedLot.replace(/^0+/, "");
                const bin = pad?.bin || undefined;
                const borough = BOROUGH_CODES[boroCode] || props?.borough || undefined;
                const zip_code = props?.postalcode || undefined;

                const verification = await verifyBBLWithPLUTO(boroCode, paddedBlock, paddedLot, address);

                if (verification.verified) {
                  const aka_addresses = await fetchAkaAddresses(bin);
                  return {
                    bin,
                    block: block || undefined,
                    lot: lot || undefined,
                    borough,
                    zip_code,
                    owner_name: verification.owner_name,
                    address: props?.name || address,
                    aka_addresses: aka_addresses.length > 0 ? aka_addresses : undefined,
                  };
                }
              }
            }
          }
        }
      } catch {
        // GeoSearch failed, fall through to PLUTO
      }

      // Strategy 2: PLUTO direct address search (fallback)
      const { street, boroCode } = parseAddress(address);
      if (street.length < 3) return null;

      const boroFilter = boroCode ? ` AND borocode='${boroCode}'` : "";
      const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%25${encodeURIComponent(street)}%25'${encodeURIComponent(boroFilter)}&$limit=5`;

      const response = await fetch(plutoUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const match = data.find((p: any) => {
            if (!inputHouseNum) return true;
            const plutoHouse = (p.address || "").match(/^(\d+)/)?.[1];
            return plutoHouse === inputHouseNum;
          }) || null;

          if (match) {
            const aka_addresses = await fetchAkaAddresses(match.bin);
            return {
              bin: match.bin || undefined,
              block: match.block || undefined,
              lot: match.lot || undefined,
              borough: BOROUGH_CODES[match.borocode] || match.borough || undefined,
              zip_code: match.zipcode || undefined,
              owner_name: match.ownername || undefined,
              address: match.address || address,
              aka_addresses: aka_addresses.length > 0 ? aka_addresses : undefined,
            };
          }
        }
      }

      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lookup property");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const lookupByBBL = async (borough: string, block: string, lot: string): Promise<NYCPropertyData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const boroCode = Object.entries(BOROUGH_CODES).find(
        ([_, name]) => name.toLowerCase() === borough.toLowerCase()
      )?.[0] || borough;

      const paddedBlock = block.padStart(5, "0");
      const paddedLot = lot.padStart(4, "0");

      const url = `https://data.cityofnewyork.us/resource/64uk-42ks.json?borocode=${boroCode}&block=${paddedBlock}&lot=${paddedLot}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch property data");

      const data = await response.json();
      if (data && data.length > 0) {
        const property = data[0];
        return {
          bin: property.bin || undefined,
          block: property.block || undefined,
          lot: property.lot || undefined,
          borough: BOROUGH_CODES[property.borocode] || undefined,
          zip_code: property.zipcode || undefined,
          owner_name: property.ownername || undefined,
          address: property.address || undefined,
        };
      }

      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lookup property");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookupByAddress, lookupByBBL, isLoading, error };
}
