import { useState } from "react";

export interface NYCPropertyData {
  bin?: string;
  block?: string;
  lot?: string;
  borough?: string;
  zip_code?: string;
  owner_name?: string;
  address?: string;
}

// NYC Borough codes mapping
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

// Patterns to strip city/state/zip from end of address
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

/**
 * Extract the street name (without house number) from an address string.
 * e.g. "1136 OGDEN AVENUE" → "OGDEN AVENUE"
 */
function extractStreetName(address: string): string {
  return address.trim().toUpperCase().replace(/^\d+[-\d]*\s+/, "").trim();
}

/**
 * Normalize common street suffixes for comparison.
 */
function normalizeStreet(street: string): string {
  return street
    .toUpperCase()
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\bPARKWAY\b/g, "PKWY")
    .replace(/[.,\s]+/g, " ")
    .trim();
}

/**
 * Check if two street names refer to the same street.
 */
function streetNamesMatch(inputStreet: string, returnedStreet: string): boolean {
  const a = normalizeStreet(extractStreetName(inputStreet));
  const b = normalizeStreet(extractStreetName(returnedStreet));
  if (!a || !b) return false;
  // Exact match after normalization
  if (a === b) return true;
  // Check if one contains the other (handles "OGDEN AVE" vs "OGDEN AVE EAST")
  return a.includes(b) || b.includes(a);
}

/**
 * Cross-verify a GeoSearch BBL result against PLUTO to confirm accuracy.
 * Returns the PLUTO record if verified, null if mismatch or not found.
 */
async function verifyBBLWithPLUTO(
  boroCode: string,
  paddedBlock: string,
  paddedLot: string,
  inputAddress: string
): Promise<{ verified: boolean; owner_name?: string; plutoAddress?: string }> {
  try {
    const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?borocode=${boroCode}&block=${paddedBlock}&lot=${paddedLot}&$select=address,ownername&$limit=1`;
    console.log("[NYC Verify] PLUTO cross-check:", plutoUrl);
    const resp = await fetch(plutoUrl);
    if (!resp.ok) return { verified: false };
    const data = await resp.json();
    if (!data?.length) {
      console.warn("[NYC Verify] BBL not found in PLUTO — may be invalid");
      return { verified: false };
    }
    const plutoAddress = data[0].address || "";
    const owner_name = data[0].ownername || undefined;

    // Verify the PLUTO address street matches our input street
    if (plutoAddress && !streetNamesMatch(inputAddress, plutoAddress)) {
      console.warn(
        `[NYC Verify] Street mismatch! Input="${extractStreetName(inputAddress)}", PLUTO="${plutoAddress}". Rejecting BBL.`
      );
      return { verified: false, plutoAddress };
    }

    console.log("[NYC Verify] PLUTO confirmed BBL. PLUTO address:", plutoAddress);
    return { verified: true, owner_name, plutoAddress };
  } catch {
    // If PLUTO is down, we can't verify — treat as unverified
    console.warn("[NYC Verify] PLUTO verification failed, skipping");
    return { verified: false };
  }
}

export function useNYCPropertyLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupByAddress = async (address: string): Promise<NYCPropertyData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[NYC Lookup] Looking up:", address);

      if (address.trim().length < 5) {
        setError("Address too short for lookup");
        return null;
      }

      const inputHouseMatch = address.trim().match(/^(\d+[-\d]*)/);
      const inputHouseNum = inputHouseMatch ? inputHouseMatch[1] : null;

      // Strategy 1: NYC GeoSearch API → then cross-verify with PLUTO
      try {
        const geoUrl = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(address)}&size=1`;
        console.log("[NYC Lookup] GeoSearch query:", geoUrl);
        const geoResponse = await fetch(geoUrl);
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          const feature = geoData?.features?.[0];
          if (feature) {
            const props = feature.properties;
            const returnedHouseNum = props?.housenumber;

            // Reject if house number doesn't match
            if (inputHouseNum && returnedHouseNum && inputHouseNum !== returnedHouseNum) {
              console.warn(
                `[NYC Lookup] House number mismatch: input="${inputHouseNum}", returned="${returnedHouseNum}". Skipping.`
              );
            } else {
              // Also verify street name from GeoSearch result
              const geoLabel = props?.name || props?.label || "";
              if (geoLabel && !streetNamesMatch(address, geoLabel)) {
                console.warn(
                  `[NYC Lookup] Street name mismatch: input="${extractStreetName(address)}", geo="${geoLabel}". Skipping.`
                );
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

                // Cross-verify BBL with PLUTO
                const verification = await verifyBBLWithPLUTO(boroCode, paddedBlock, paddedLot, address);

                if (!verification.verified) {
                  console.warn(
                    `[NYC Lookup] GeoSearch BBL ${bbl} failed PLUTO cross-verification for "${address}". Skipping.`
                  );
                } else {
                  console.log("[NYC Lookup] GeoSearch + PLUTO verified:", { borough, block, lot, bin, zip_code });
                  return {
                    bin,
                    block: block || undefined,
                    lot: lot || undefined,
                    borough,
                    zip_code,
                    owner_name: verification.owner_name,
                    address: props?.name || address,
                  };
                }
              }
            }
          }
        }
      } catch (geoErr) {
        console.warn("[NYC Lookup] GeoSearch failed, falling back to PLUTO:", geoErr);
      }

      // Strategy 2: PLUTO direct address search (fallback)
      const { street, boroCode } = parseAddress(address);
      if (street.length < 3) return null;

      const boroFilter = boroCode ? ` AND borocode='${boroCode}'` : "";
      const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%25${encodeURIComponent(street)}%25'${encodeURIComponent(boroFilter)}&$limit=5`;
      console.log("[NYC Lookup] PLUTO fallback query:", plutoUrl);

      const response = await fetch(plutoUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          // Find the best match by checking house number
          const match = data.find((p: any) => {
            if (!inputHouseNum) return true;
            const plutoHouse = (p.address || "").match(/^(\d+)/)?.[1];
            return plutoHouse === inputHouseNum;
          }) || null;

          if (match) {
            return {
              bin: match.bin || undefined,
              block: match.block || undefined,
              lot: match.lot || undefined,
              borough: BOROUGH_CODES[match.borocode] || match.borough || undefined,
              zip_code: match.zipcode || undefined,
              owner_name: match.ownername || undefined,
              address: match.address || address,
            };
          }
        }
      }

      return null;
    } catch (err) {
      console.error("NYC property lookup error:", err);
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
      console.error("NYC BBL lookup error:", err);
      setError(err instanceof Error ? err.message : "Failed to lookup property");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookupByAddress, lookupByBBL, isLoading, error };
}
