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

export function useNYCPropertyLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupByAddress = async (address: string): Promise<NYCPropertyData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Use NYC Open Data PLUTO dataset for property lookup
      // Clean and encode the address for the API
      const cleanAddress = address.trim().toUpperCase();
      
      // Try the NYC Geoclient API via NYC Open Data
      const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%${encodeURIComponent(cleanAddress.substring(0, 20))}%'&$limit=5`;
      
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

      // Fallback: Try PAD (Property Address Directory) dataset
      const padUrl = `https://data.cityofnewyork.us/resource/bc93-7baw.json?$where=upper(stname) like '%${encodeURIComponent(cleanAddress.split(" ").slice(1).join(" ").substring(0, 15))}%'&$limit=5`;
      
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
      // Convert borough name to code if needed
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
