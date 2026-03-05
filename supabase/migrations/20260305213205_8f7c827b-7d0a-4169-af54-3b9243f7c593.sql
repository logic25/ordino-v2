-- Any property that has block + lot + bin should be verified
UPDATE public.properties 
SET bbl_verified = true 
WHERE block IS NOT NULL 
  AND lot IS NOT NULL 
  AND bin IS NOT NULL
  AND (bbl_verified IS NULL OR bbl_verified = false);

-- Properties with no block or no lot get null (unknown), not false (failed)
UPDATE public.properties
SET bbl_verified = null
WHERE (block IS NULL OR lot IS NULL)
  AND bbl_verified = false;