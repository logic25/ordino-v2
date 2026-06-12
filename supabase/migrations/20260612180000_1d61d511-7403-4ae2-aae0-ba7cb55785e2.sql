-- Import: Popl event leads + live TIMS targets (LXD>=2026 only; 165 stale rows skipped).
-- Idempotent; owners resolved via auth.users email -> profiles; dedupe on email / TIMS name.

-- Event for the June Popl captures (per the RED Connect email thread)
INSERT INTO public.bd_events (company_id, name, category, status, start_date, location, notes)
SELECT c.id, 'RED Connect', 'RED Connect', 'ATTENDED', '2026-06-04', 'Moxy Hotel, NYC', 'June networking event — 8 leads captured via Popl'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'RED Connect');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Owen A. Bryan Jr.', 'Eagle Eye Management', 'Project Manager & Construction Broker', 'eagleeyemanage@gmail.com', '+19144098589', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'RED Connect' LIMIT 1), 'Captured via Popl (Business Card) 2026-06-05'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'eagleeyemanage@gmail.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Carol Delille Elias', 'Real Broker NY LLC', 'Licensed Real Estate Salesperson', 'carolelias.re@gmail.com', '+13473123458', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'RED Connect' LIMIT 1), 'Replied 6/10: reciprocal referrals — send her renting/selling clients. Residential agent = referral partner, not buyer. | Captured via Popl (Business Card) 2026-06-05'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'carolelias.re@gmail.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Alan M. Schneider', 'ALANACTION.COM', 'President/director', 'info@alanaction.com', '+15164738399', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'RED Connect' LIMIT 1), 'Captured via Popl (Business Card) 2026-06-05'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'info@alanaction.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Mike Layer', 'NY Built Construction', 'Project Manager, Renovation Consultant', 'mike@nybuilt.com', '+16466671515', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'RED Connect' LIMIT 1), 'Captured via Popl (Business Card) 2026-06-05'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'mike@nybuilt.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Anthony R. Jackson', 'Ginsburg & Misk LLP', 'Attorney At Law', 'anthonyjackson.esq@gmail.com', '+17184680500', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'RED Connect' LIMIT 1), 'Work email ajackson@gmlawyers.net BOUNCES — use this gmail. Warm: wants event invites + floated a BD-role candidate (client''''s daughter). | LinkedIn: http://www.linkedin.com/in/anthony-jackson-40933432 | Captured via Popl (Business Card) 2026-06-05'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'anthonyjackson.esq@gmail.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Charlie Romanak', NULL, NULL, 'charlier@peakexchange.com', '+15126580049', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'RED Connect' LIMIT 1), 'Captured via Popl (Lead capture form) 2026-06-05'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'charlier@peakexchange.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'James Bender', NULL, NULL, 'james.b@hamiltonsterlingcapital.com', '+17736797167', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'RED Connect' LIMIT 1), 'Captured via Popl (Lead capture form) 2026-06-05'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'james.b@hamiltonsterlingcapital.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Lawrence Wen', 'Crest Hollow Country Club', 'Operations Manager', 'lawrence@cresthollow.com', '+15166928000', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'RED Connect' LIMIT 1), 'Follow up in July | LinkedIn: http://www.linkedin.com/in/lawrence-wen-b488b797 | Captured via Popl (Business Card) 2026-06-03'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'lawrence@cresthollow.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Traci GUBERMAN', NULL, NULL, 'traci@plymouthny.com', NULL, 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'New York Build 2026 Expo' LIMIT 1), 'Captured via Popl (QR code scan) 2026-03-19'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'chris@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'traci@plymouthny.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Brian', NULL, NULL, 'bryan.quandt@optimizmsolutions.com', NULL, 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'New York Build 2026 Expo' LIMIT 1), 'LinkedIn: http://www.linkedin.com/in/bryan-quandt | Captured via Popl (QR code scan) 2026-03-19'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'chris@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'bryan.quandt@optimizmsolutions.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'xinli zhou', NULL, NULL, 'xzhou@yhsarchitecte.com', '+15147461818', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'New York Build 2026 Expo' LIMIT 1), 'Captured via Popl (Lead capture form) 2026-03-19'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'chris@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'xzhou@yhsarchitecte.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Amit Mavalankar', NULL, NULL, 'amit.mavalankar@fpaengineers.com', '+17322792953', 'event', 'EVENT', 'new', 'NEW', (SELECT e.id FROM public.bd_events e WHERE e.company_id = p.company_id AND e.name = 'New York Build 2026 Expo' LIMIT 1), 'Captured via Popl (Lead capture form) 2026-03-19'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'chris@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'amit.mavalankar@fpaengineers.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Robert L. Kraft, M.d., F.a.c.s.', 'The Forest Hills Plastic Surgery Center', 'Diplomate, American Board Of Plastic Surgery', 'foresthillsplasticsurgery@yahoo.com', '+15617077567', 'event', 'EVENT', 'new', 'NEW', NULL, 'LinkedIn: https://www.linkedin.com/in/robertkraftllc | Captured via Popl (Business Card) 2026-02-05'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'natalia@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'foresthillsplasticsurgery@yahoo.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Daniel Sperling', 'PHAWoodworks.com', 'Vice President', 'dan@phawoodworks.com', '+15167949794', 'event', 'EVENT', 'new', 'NEW', NULL, 'LinkedIn: http://www.linkedin.com/in/daniel-sperling-b077061b | Captured via Popl (Business Card) 2026-01-28 | Company addr: 300 Manida St, The Bronx, NY 10474, USA'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'dan@phawoodworks.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Michael Magiasis', 'G Shines Glass & Metal Inc', 'Managing Director', 'gmglassny@gmail.com', '+16319740980', 'event', 'EVENT', 'new', 'NEW', NULL, 'Captured via Popl (Business Card) 2026-01-28'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'gmglassny@gmail.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Jonathan Beuttler', 'Radson Development', 'Senior Vice President Of Development', 'jonathan@rad-son.com', '+15167309300', 'event', 'EVENT', 'new', 'NEW', NULL, 'LinkedIn: http://www.linkedin.com/in/jonathan-beuttler-9b03071a | Captured via Popl (Business Card) 2026-01-28'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'jonathan@rad-son.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Andrew Esposito', 'Apex Development NY', 'Founder And Principal', 'andrew@apexdevelopmentny.com', '+19178336889', 'event', 'EVENT', 'new', 'NEW', NULL, 'LinkedIn: http://www.linkedin.com/in/andrew-esposito-95a1349a | Captured via Popl (Business Card) 2026-01-28'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'andrew@apexdevelopmentny.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'John Valladares', 'Slate Property Group', 'Managing Director', 'jvalladares@slatepg.com', '+19174345545', 'event', 'EVENT', 'new', 'NEW', NULL, 'LinkedIn: http://www.linkedin.com/in/john-valladares-2876465 | Captured via Popl (Business Card) 2026-01-28 | Company addr: 38 E 29th St 9th Floor, New York, NY 10016, USA'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'jvalladares@slatepg.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'David Schwartz', 'Slate Property Group', 'Principal', 'david@slatepg.com', '+16467621429', 'event', 'EVENT', 'new', 'NEW', NULL, 'LinkedIn: http://www.linkedin.com/in/david-schwartz-19a7161 | Captured via Popl (Business Card) 2026-01-28 | Company addr: 38 E 29th St 9th Floor, New York, NY 10016, USA'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'david@slatepg.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Antonino R Liotta', 'A.R.L. Plumbing & Heating LLC', NULL, 'antonior@arlplumbing.com', '+17188222232', 'event', 'EVENT', 'new', 'NEW', NULL, 'Captured via Popl (Business Card) 2026-01-28'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'antonior@arlplumbing.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Tony Langthorne', 'Modin Inc', NULL, 'info@modininc.com', '+13473380582', 'event', 'EVENT', 'new', 'NEW', NULL, 'Captured via Popl (Business Card) 2026-01-28'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'info@modininc.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Annabelle Zhuño', 'Office of the Brooklyn Borough President', 'Executive Assistant To The Borough President', 'annabelle.zhuno@brooklynbp.nyc.gov', '+17188024581', 'event', 'EVENT', 'new', 'NEW', NULL, 'Captured via Popl (Business Card) 2026-01-28 | Company addr: 1 Centre St, New York, NY 10007, USA'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'annabelle.zhuno@brooklynbp.nyc.gov');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Yun Li', 'SCG America Construction Inc.', 'Development And Zoning Specialist', 'yun.li@scgamerica.com', '+12127890000', 'event', 'EVENT', 'new', 'NEW', NULL, 'LinkedIn: http://www.linkedin.com/in/yunlii | Captured via Popl (Business Card) 2026-01-28 | Company addr: 1500 Broadway #3300, New York, NY 10036, USA'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'yun.li@scgamerica.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, role, contact_email, contact_phone, source, source_type, status, stage, event_id, notes)
SELECT p.company_id, p.id, p.id, 'Miles Mahony', 'RIPCO Real Estate', 'Executive Vice President', 'mmahony@ripcony.com', '+12127506592', 'event', 'EVENT', 'new', 'NEW', NULL, 'LinkedIn: http://www.linkedin.com/in/milesmahony | Captured via Popl (Business Card) 2026-01-28 | Company addr: 100 Jericho Quadrangle #120, Jericho, NY 11753, USA'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND lower(l.contact_email) = 'mmahony@ripcony.com');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Jefferies', 'Jefferies', 'TIMS — 700,000-700,000 SF — LXD 2029', '520 Madison Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Rob Lowe/Kelli Berke/David Hoffman (Cushman & Wakefield) | Status as of 3/2024: Hired Broker | Industry: Investment Banking | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Jefferies' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Ropes & Gray', 'Ropes & Gray', 'TIMS — 420,000-420,000 SF — LXD 2027', '1211 Avenue of the Americas', 'other', 'OTHER', 'new', 'NEW', 'Broker: Mark Weiss (Cushman & Wakefield) | Status as of 3/2024: Hired Broker | Industry: Legal Services | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Ropes & Gray' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Christie''s', 'Christie''s', 'TIMS — 300,000-350,000 SF — LXD 2028', '20 Rockefeller Plaza', 'other', 'OTHER', 'new', 'NEW', 'Broker: Mary Ann Tighe/Rob Hill (CBRE) | Status as of 3/2024: Lease Out | Industry: Auctioneer | close to completing a long term renewal (2.27.24) | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Christie''s' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'National Basketball Association (NBA)', 'National Basketball Association (NBA)', 'TIMS — 300,000-300,000 SF — LXD 2035', '645 Fifth Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Mary Anne Tighe/Andrew Sussman (CBRE) | Status as of 3/2024: Hired Broker | Industry: Professional Sports | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'National Basketball Association (NBA)' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Willkie Farr & Gallagher LLP', 'Willkie Farr & Gallagher LLP', 'TIMS — 300,000-300,000 SF — LXD 2027', '787 Seventh Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Neil Goldmacher (Newmark) | Status as of 3/2024: Touring | Industry: Legal Services | toured several DT options (Aug ''''23) | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Willkie Farr & Gallagher LLP' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Winston & Strawn LLP', 'Winston & Strawn LLP', 'TIMS — 250,000-300,000 SF — LXD 2027', '200 Park Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: David Goldstein/Mambrino (Savills) | Status as of 3/2024: Touring | Industry: Legal Services | Active in the market, rumored to be focused on renewing at 200 park  - Mambrino Savills | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Winston & Strawn LLP' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Goodwin Procter', 'Goodwin Procter', 'TIMS — 275,000-275,000 SF — LXD 2028', '620 Eighth Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Mark Weiss (Cushman & Wakefield) | Status as of 3/2024: Hired Broker | Industry: Legal Services | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Goodwin Procter' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Covington & Burling', 'Covington & Burling', 'TIMS — 250,000-250,000 SF — LXD 2029', '620 Eighth Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: TBD (TBD) | Status as of 3/2024: Touring | Industry: Legal Services | looking at 30 Hudson Yards | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Covington & Burling' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Ares Management', 'Ares Management', 'TIMS — 200,000-250,000 SF — LXD 2026', '245 Park Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Lewis Miller (CBRE) | Status as of 3/2024: Hired Broker | Industry: Asset Management | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Ares Management' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Alvarez & Marsal', 'Alvarez & Marsal', 'TIMS — 200,000-250,000 SF — LXD 2026', '600 Madison Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: David Dusek (Cushman & Wakefield) | Status as of 3/2024: Hired Broker | Industry: Consulting | Will start re-engaging the market in NYC in early 2024 | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Alvarez & Marsal' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'MongoDB', 'MongoDB', 'TIMS — 100,000-200,000 SF — LXD 2029', '1633 Broadway', 'other', 'OTHER', 'new', 'NEW', 'Broker: Hrobsky/Helgesen/Ceder/Trivelas (Cushman & Wakefield) | Status as of 3/2024: Hired Broker | Industry: Computer Software | Active again as of January 2024 | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'MongoDB' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'PitchBook', 'PitchBook', 'TIMS — 100,000-150,000 SF — LXD 2029', '315 Park Avenue South', 'other', 'OTHER', 'new', 'NEW', 'Broker: Sam Spillane (CBRE) | Status as of 3/2024: Hired Broker | Industry: FinTech | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'PitchBook' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Major League Soccer (MLS)', 'Major League Soccer (MLS)', 'TIMS — 100,000-150,000 SF — LXD 2026', '420 Fifth Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Dan Posy (JLL) | Status as of 3/2024: Lease Out | Industry: Professional Sports | Lease out at Penn 2 | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Major League Soccer (MLS)' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Richemont', 'Richemont', 'TIMS — 60,000-150,000 SF — LXD 2028', '645 Fifth Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Mary Ann Tighe/Eric Thomas (CBRE) | Status as of 3/2024: On Hold | Industry: Retail/Wholesale | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Richemont' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'BakerHostetler', 'BakerHostetler', 'TIMS — 125,000-125,000 SF — LXD 2027', '45 Rockefeller Plaza', 'other', 'OTHER', 'new', 'NEW', 'Broker: John Mayer (CBRE) | Status as of 3/2024: Hired Broker | Industry: Legal Services | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'BakerHostetler' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Orrick Herrington & Sutcliffe LLP', 'Orrick Herrington & Sutcliffe LLP', 'TIMS — 100,000-125,000 SF — LXD 2026', '51 West 52nd Street', 'other', 'OTHER', 'new', 'NEW', 'Broker: TBD (CBRE) | Status as of 3/2024: Hired Broker | Industry: Legal Services | Kicking off long term occupancy planning | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Orrick Herrington & Sutcliffe LLP' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Gen II Fund Services', 'Gen II Fund Services', 'TIMS — 100,000-120,000 SF — LXD 2026', '805 Third Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: William Iacovelli (CBRE) | Status as of 3/2024: Early Stages | Industry: Private Equity | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Gen II Fund Services' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'LVMH', 'LVMH', 'TIMS — 100,000-100,000 SF — LXD 2031', '19 East 57th Street', 'other', 'OTHER', 'new', 'NEW', 'Broker: Jeff Peck/Dan Horowitz (Savills) | Status as of 3/2024: Hired Broker | Industry: Retail/Wholesale | deal died, on hold (7.24.23).  Back in the market (3/2024) | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'LVMH' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'TD Bank', 'TD Bank', 'TIMS — 100,000-100,000 SF — LXD 2035', 'One Vanderbilt', 'other', 'OTHER', 'new', 'NEW', 'Broker: Bob Alexander (CBRE) | Status as of 3/2024: Lease Out | Industry: Bank | L/O at 335 Madison | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'TD Bank' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Baker McKenzie', 'Baker McKenzie', 'TIMS — 100,000-100,000 SF — LXD 2026', '452 Fifth Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: John Mambrino (Savills) | Status as of 3/2024: Hired Broker | Industry: Legal Services | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Baker McKenzie' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Mizuho', 'Mizuho', 'TIMS — 80,000-100,000 SF — LXD 2026', '1251 Avenue of the Americas', 'other', 'OTHER', 'new', 'NEW', 'Broker: Riguardi (JLL) | Status as of 3/2024: Hired Broker | Industry: International Banking | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Mizuho' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Haynes & Boone LLP', 'Haynes & Boone LLP', 'TIMS — 60,000-100,000 SF — LXD 2026', '30 Rockefeller Plaza', 'other', 'OTHER', 'new', 'NEW', 'Brokerage: Newmark | Status as of 3/2024: Hired Broker | Industry: Legal Services | Active in the market | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Haynes & Boone LLP' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'W2o Group', 'W2o Group', 'TIMS — 60,000-85,000 SF — LXD 2030', '199 Water Street', 'other', 'OTHER', 'new', 'NEW', 'Broker: Eric Kagner (Newmark) | Status as of 3/2024: On Hold | Industry: Marketing | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'W2o Group' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'IFM Investors', 'IFM Investors', 'TIMS — 80,000-80,000 SF — LXD 2031', '114 West 47th Street', 'other', 'OTHER', 'new', 'NEW', 'Broker: Jeff Peck (Savills) | Status as of 3/2024: Hired Broker | Industry: Investment Management | expansion (growth) | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'IFM Investors' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'SoFi', 'SoFi', 'TIMS — 40,000-60,000 SF — LXD 2027', '860 Washington Street', 'other', 'OTHER', 'new', 'NEW', 'Broker: Kyle Riker (JLL) | Status as of 3/2024: Hired Broker | Industry: FinTech | currently in about 25K in 860 Washington Street and is looking to expand and reduce costs | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'SoFi' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Glencore Limited', 'Glencore Limited', 'TIMS — 50,000-50,000 SF — LXD 2030', '330 Madison Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Jeff Peck (Savills) | Status as of 3/2024: Hired Broker | Industry: Commodities Trading | looking for deals in the $50''''s psf | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Glencore Limited' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Brunello Cucinelli', 'Brunello Cucinelli', 'TIMS — 50,000-50,000 SF — LXD 2027', '689 Fifth Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Joe Fabrizi (CBRE) | Status as of 3/2024: Hired Broker | Industry: Fashion Retailer | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Brunello Cucinelli' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'New Mountain Capital LLC', 'New Mountain Capital LLC', 'TIMS — 50,000-50,000 SF — LXD 2035', '1633 Broadway', 'other', 'OTHER', 'new', 'NEW', 'Broker: Tim Freydburg (CBRE) | Status as of 3/2024: Lease Out | Industry: Private Equity | Deal Pending per Tim Freydberg (12.5.23)  Sublease out close to 1633 Bway for 30K sf (11-2023) | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'New Mountain Capital LLC' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Agricultural Bank of China', 'Agricultural Bank of China', 'TIMS — 40,000-50,000 SF — LXD 2027', '277 Park Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Michael Burgio (Cushman & Wakefield) | Status as of 3/2024: Hired Broker | Industry: International Bank | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Agricultural Bank of China' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Freshfields Bruckhaus Deringer US LLP', 'Freshfields Bruckhaus Deringer US LLP', 'TIMS — 40,000-40,000 SF — LXD 2040', 'Three World Trade', 'other', 'OTHER', 'new', 'NEW', 'Broker: David Goldstein (Savills) | Status as of 3/2024: Hired Broker | Industry: Legal Services | looking for expansion space | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Freshfields Bruckhaus Deringer US LLP' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Ellenoff Grossman Schole LLP', 'Ellenoff Grossman Schole LLP', 'TIMS — 40,000-40,000 SF — LXD 2026', '1345 Avenue of the Americas', 'other', 'OTHER', 'new', 'NEW', 'Broker: Andy Sachs (Newmark) | Status as of 3/2024: Hired Broker | Industry: Legal Services | In 65k now,  will be in market for 40k out of 1345 on an AB sublease, expiring 12/31 | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Ellenoff Grossman Schole LLP' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Evergreen Trading', 'Evergreen Trading', 'TIMS — 40,000-40,000 SF — LXD 2027', '99 Hudson Street', 'other', 'OTHER', 'new', 'NEW', 'Broker: Mike Berg (JLL) | Status as of 3/2024: Hired Broker | Industry: Media Investment Agency | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Evergreen Trading' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Third Point', 'Third Point', 'TIMS — 30,000-30,000 SF — LXD 2029', '55 Hudson Yards', 'other', 'OTHER', 'new', 'NEW', 'Broker: Alex Chudnoff (JLL) | Status as of 3/2024: Hired Broker | Industry: Hedge Fund | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Third Point' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Bulgari', 'Bulgari', 'TIMS — 25,000-25,000 SF — LXD 2032', '625 Madison Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Peck/Horowitz (Savills) | Status as of 3/2024: Hired Broker | Industry: Jewelery/Retail | looking for either a termination/buyout/attractive enough dela to test sublease market | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Bulgari' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Insight Venture Partners', 'Insight Venture Partners', 'TIMS — 15,000-15,000 SF — LXD 2030', '1114 Avenue of the Americas', 'other', 'OTHER', 'new', 'NEW', 'Broker: Rob Martin (JLL) | Status as of 3/2024: Hired Broker | Industry: Investment Advisor | looking to expand | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Insight Venture Partners' AND l.subject LIKE 'TIMS%');

INSERT INTO public.leads (company_id, created_by, assigned_to, full_name, company, subject, property_address, source, source_type, status, stage, notes)
SELECT p.company_id, p.id, p.id, 'Bond, Schoeneck & King PLLC', 'Bond, Schoeneck & King PLLC', 'TIMS — 15,000-15,000 SF — LXD 2026', '600 Third Avenue', 'other', 'OTHER', 'new', 'NEW', 'Broker: Peck/Horowitz (Savills) | Status as of 3/2024: Hired Broker | Industry: Legal Services | Source: TIMS list 3/29/24 — VERIFY still in market'
FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
WHERE lower(u.email) = 'manny@greenlightexpediting.com'
  AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = p.company_id AND l.full_name = 'Bond, Schoeneck & King PLLC' AND l.subject LIKE 'TIMS%');
