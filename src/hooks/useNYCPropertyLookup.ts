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

/**
 * Extract borough from raw address if present.
 * Returns { street, boroCode } where boroCode is "1"-"5" or null.
 */
function parseAddress(raw: string): { street: string; boroCode: string | null } {
  const upper = raw.trim().toUpperCase();

  // Try to find borough name in the address
  let detectedBoroCode: string | null = null;
  for (const [name, code] of Object.entries(BOROUGH_NAME_TO_CODE)) {
    const regex = new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(raw)) {
      detectedBoroCode = code;
      break;
    }
  }

  // Strip borough/city/state/zip to get clean street address
  let street = upper;
  for (const pattern of STRIP_PATTERNS) {
    street = street.replace(pattern, "");
  }
  street = street.replace(/[,\s]+$/, "").trim();

  return { street, boroCode: detectedBoroCode };
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

      // Strategy 1: NYC GeoSearch API (most reliable for address → BBL/BIN)
      try {
        const geoUrl = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(address)}&size=1`;
        console.log("[NYC Lookup] GeoSearch query:", geoUrl);
        const geoResponse = await fetch(geoUrl);
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          const feature = geoData?.features?.[0];
          if (feature) {
            const props = feature.properties;
            const pad = props?.addendum?.pad;
            const bbl = pad?.bbl || "";
            // Parse BBL: first digit = boro, next 5 = block, last 4 = lot
            const boroCode = bbl.substring(0, 1);
            const block = bbl.substring(1, 6).replace(/^0+/, "");
            const lot = bbl.substring(6, 10).replace(/^0+/, "");
            const bin = pad?.bin || undefined;
            const borough = BOROUGH_CODES[boroCode] || props?.borough || undefined;
            const zip_code = props?.postalcode || undefined;

            // Enrich with PLUTO for owner name
            let owner_name: string | undefined;
            if (bbl) {
              try {
                const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?borocode=${boroCode}&block=${bbl.substring(1, 6)}&lot=${bbl.substring(6, 10)}&$select=ownername&$limit=1`;
                const plutoResp = await fetch(plutoUrl);
                if (plutoResp.ok) {
                  const plutoData = await plutoResp.json();
                  if (plutoData?.[0]?.ownername) {
                    owner_name = plutoData[0].ownername;
                  }
                }
              } catch {
                // Owner enrichment is optional
              }
            }

            console.log("[NYC Lookup] GeoSearch found:", { borough, block, lot, bin, zip_code, owner_name });
            return {
              bin,
              block: block || undefined,
              lot: lot || undefined,
              borough,
              zip_code,
              owner_name,
              address: props?.name || address,
            };
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
          const property = data[0];
          return {
            bin: property.bin || undefined,
            block: property.block || undefined,
            lot: property.lot || undefined,
            borough: BOROUGH_CODES[property.borocode] || property.borough || undefined,
            zip_code: property.zipcode || undefined,
            owner_name: property.ownername || undefined,
            address: property.address || address,
          };
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
