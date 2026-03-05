-- Set bbl_verified = true for properties with block AND lot present
UPDATE public.properties 
SET bbl_verified = true 
WHERE block IS NOT NULL AND lot IS NOT NULL 
  AND (bbl_verified IS NULL OR bbl_verified = false);

-- Set bbl_verified = false (explicit) for properties missing block OR lot
UPDATE public.properties 
SET bbl_verified = false 
WHERE (block IS NULL OR lot IS NULL) 
  AND bbl_verified IS NULL;