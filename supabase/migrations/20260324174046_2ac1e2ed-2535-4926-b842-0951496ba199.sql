
-- Delete orphan duplicates (both have zero or fewer linked records than their counterpart)
DELETE FROM properties WHERE id IN (
  'd3a6a4b7-3781-40eb-ba45-6f545339bdae',
  'd23ae276-a024-4e2c-8215-3bee16f97d81'
);

-- Prevent future duplicates: unique on company_id + bin
CREATE UNIQUE INDEX idx_properties_company_bin_unique 
ON properties (company_id, bin) 
WHERE bin IS NOT NULL;
