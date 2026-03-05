-- Fix bbl_verified for properties that have complete BBL data
UPDATE public.properties 
SET bbl_verified = true 
WHERE borough IS NOT NULL 
  AND block IS NOT NULL 
  AND lot IS NOT NULL 
  AND (bbl_verified IS NULL OR bbl_verified = false);