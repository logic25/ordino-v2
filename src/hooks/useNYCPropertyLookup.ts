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

// Common suffixes to strip from addresses before querying
const STRIP_PATTERNS = [
  /,?\s*(new\s*york|nyc|ny|manhattan|bronx|brooklyn|queens|staten\s*island)\s*(,?\s*(ny|new\s*york))?\s*\d{0,5}\s*$/i,
  /,?\s*(ny|new\s*york)\s*\d{0,5}\s*$/i,
  /\s+\d{5}(-\d{4})?\s*$/,  // zip code at end
];

/**
 * Extract just the street address (house number + street name) from a full address.
 * e.g. "1136 Ogden Avenue Bronx NY 10452" → "1136 OGDEN AVENUE"
 */
function cleanStreetAddress(raw: string): string {
  let addr = raw.trim().toUpperCase();
  for (const pattern of STRIP_PATTERNS) {
    addr = addr.replace(pattern, "");
  }
  // Also strip trailing commas/spaces
  addr = addr.replace(/[,\s]+$/, "").trim();
  return addr;
}

export function useNYCPropertyLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupByAddress = async (address: string): Promise<NYCPropertyData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const streetAddress = cleanStreetAddress(address);
      console.log("[NYC Lookup] Cleaned address:", streetAddress, "from:", address);

      if (streetAddress.length < 3) {
        setError("Address too short for lookup");
        return null;
      }

      // Strategy 1: Try PLUTO with the full cleaned street address
      const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%25${encodeURIComponent(streetAddress)}%25'&$limit=5`;
      console.log("[NYC Lookup] PLUTO query:", plutoUrl);
      
      const response = await fetch(plutoUrl);
      
      if (!response.ok) {
        throw new Error("Failed to fetch property data");
      }

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

      // Strategy 2: Extract house number and street name separately
      const houseMatch = streetAddress.match(/^(\d+[-\d]*)\s+(.+)$/);
      if (houseMatch) {
        const houseNum = houseMatch[1];
        const streetName = houseMatch[2];
        
        // Try PAD dataset with house number and street name
        const padUrl = `https://data.cityofnewyork.us/resource/bc93-7baw.json?$where=lhnd='${encodeURIComponent(houseNum)}' AND upper(stname) like '%25${encodeURIComponent(streetName.substring(0, 20))}%25'&$limit=5`;
        console.log("[NYC Lookup] PAD query:", padUrl);
        
        const padResponse = await fetch(padUrl);
        if (padResponse.ok) {
          const padData = await padResponse.json();
          if (padData && padData.length > 0) {
            const prop = padData[0];
            return {
              bin: prop.bin || undefined,
              block: prop.block || undefined,
              lot: prop.lot || undefined,
              borough: BOROUGH_CODES[prop.boro] || undefined,
              zip_code: prop.zipcode || undefined,
              address: address,
            };
          }
        }

        // Strategy 3: Try PLUTO with just house number + first part of street
        const shortStreet = streetName.split(/\s+(AVE|AVENUE|ST|STREET|BLVD|BOULEVARD|PL|PLACE|DR|DRIVE|RD|ROAD|CT|COURT|WAY|LN|LANE|TER|TERRACE)/i)[0];
        if (shortStreet && shortStreet !== streetName) {
          const pluto2Url = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%25${encodeURIComponent(houseNum + " " + shortStreet)}%25'&$limit=5`;
          console.log("[NYC Lookup] PLUTO fallback query:", pluto2Url);
          
          const pluto2Response = await fetch(pluto2Url);
          if (pluto2Response.ok) {
            const pluto2Data = await pluto2Response.json();
            if (pluto2Data && pluto2Data.length > 0) {
              const property = pluto2Data[0];
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
      
      if (!response.ok) {
        throw new Error("Failed to fetch property data");
      }

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

  return {
    lookupByAddress,
    lookupByBBL,
    isLoading,
    error,
  };
}
