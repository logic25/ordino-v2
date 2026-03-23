UPDATE companies 
SET 
  logo_url = 'https://mimlfjkisguktiqqkpkm.supabase.co/storage/v1/object/public/company-assets/logos/GLE_Final_Logo.png',
  theme = jsonb_set(COALESCE(theme, '{}')::jsonb, '{logo_url}', '"https://mimlfjkisguktiqqkpkm.supabase.co/storage/v1/object/public/company-assets/logos/GLE_Final_Logo.png"'),
  settings = jsonb_set(COALESCE(settings, '{}')::jsonb, '{company_logo_url}', '"https://mimlfjkisguktiqqkpkm.supabase.co/storage/v1/object/public/company-assets/logos/GLE_Final_Logo.png"')
WHERE logo_url LIKE '%GLE_Final_Logo.webp%';