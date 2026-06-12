-- Seed: GLE 2026 Event Calendar (v3, verified pricing) into bd_events.
-- Idempotent: skips events that already exist per company (matched on name).
-- Priority mapping: GO->APPROVED, DISCUSS/?->PENDING_APPROVAL, PAST/SKIP->SKIPPED.

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, '130th REBNY Annual Gala', 'REBNY', 'SKIPPED', NULL, '2026-01-22', 'Waldorf Astoria NYC', 'https://www.rebny.com/events/', NULL, NULL, true, 'Biggest NYC RE event of the year. | MUST-ATTEND in 2027. | Add to 2027 calendar | Jan 22'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = '130th REBNY Annual Gala');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Bisnow: NYC Adaptive Reuse', 'Bisnow', 'SKIPPED', NULL, '2026-02-25', 'NYC', 'https://www.bisnow.com/events/new-york', NULL, NULL, false, 'Complex filings = GLE work. | Attend in 2027. | Feb 25'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Bisnow: NYC Adaptive Reuse');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Bisnow: NYC Multifamily Development & Investment', 'Bisnow', 'PENDING_APPROVAL', 'DISCUSS', '2026-03-12', 'Convene, 237 Park Ave, Ground Fl, NYC 10017', 'https://www.bisnow.com/events/new-york/multifamily/new-york-multifamily-development-investment-conference-10169', 249.0, 249.0, false, 'Multifamily devs do build-outs. 4 panels + networking breakfast. | $249 is real price. Is multifamily worth it for GLE? | Register ONLY if team says GO | Mar 12, 8am-12:30pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Bisnow: NYC Multifamily Development & Investment');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'New York Build 2026 Expo', 'NY Build', 'APPROVED', 'GO', '2026-03-18', 'Javits Center, Hall 3B Level 3, 429 11th Ave NYC 10001', 'https://forms.reg.buzz/new-york-build-2026', 0, 0, false, 'FREE. 550+ speakers, 550+ exhibitors, 14 tracks, 25+ networking parties. | No-brainer. 2 full days, zero cost. | REGISTER NOW: forms.reg.buzz/new-york-build-2026 | Mar 18-19, 9:30am-5:30pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'New York Build 2026 Expo');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NY Building Congress: March Construction Industry Breakfast', 'NY Building Congress', 'APPROVED', 'GO', '2026-03-26', 'New York Hilton Midtown, Trianon Ballroom, 1335 6th Ave NYC', 'https://www.buildingcongress.com/events/', 95.0, 150.0, false, 'NYBC breakfasts draw 500+ construction leaders. Exact GLE audience. | Must-attend. $95 member rate. Big networking room. | Register Natalia | Mar 26, 8am'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NY Building Congress: March Construction Industry Breakfast');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Bisnow: NYC Retail Conference', 'Bisnow', 'APPROVED', 'GO', '2026-03-31', '20 Times Square, 701 7th Ave, NYC 10036', 'https://www.bisnow.com/events/new-york/retail/new-york-retail-conference-10179', 215.0, 215.0, false, 'Retail build-outs = core GLE. 30+ speakers, 4 panels. | $215 current tier. Price goes UP. Register now. | Register Natalia ASAP | Mar 31, 8am-12:30pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Bisnow: NYC Retail Conference');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'REBNY Spring Members Luncheon', 'REBNY', 'APPROVED', 'GO', '2026-03-01', 'NYC (TBD)', 'https://www.rebny.com/events/', NULL, NULL, true, 'Must-attend. Top broker concentration. | Non-negotiable. Date not posted yet. | Check rebny.com/events weekly | Late Mar (TBD)'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'REBNY Spring Members Luncheon');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'WBC Policy & Infrastructure AIM Forum', 'WBC', 'PENDING_APPROVAL', 'DISCUSS', '2026-04-15', 'NYC (TBD)', 'https://www.wbcnyc.org/upcoming-events-wbc/4152026-policy-and-infrastructure-aim-forum', NULL, NULL, false, 'WBC event. Infrastructure + policy angle. | Price not posted yet. WBC membership may be required ($500/yr). | Monitor wbcnyc.org for pricing | Apr 15'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'WBC Policy & Infrastructure AIM Forum');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Bisnow: NYC Infrastructure & Transportation', 'Bisnow', 'PENDING_APPROVAL', 'DISCUSS', '2026-04-16', 'Marriott Marquis, 1535 Broadway, Astor Ballroom 7th Fl, NYC', 'https://www.bisnow.com/events/new-york/infrastructure/new-york-infrastructure-public-private-projects-transportation-event-10039', 120.0, 120.0, false, 'Large infrastructure projects. | $120 current price. Is infrastructure relevant to GLE? | Hold — check with team | Apr 16, 8am-11am'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Bisnow: NYC Infrastructure & Transportation');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'BOMA NY Energy Action Day', 'BOMA NY', 'PENDING_APPROVAL', 'DISCUSS', '2026-04-22', 'NYC (TBD)', 'https://www.bomany.org/2026-upcoming-events-calendar.html', NULL, NULL, true, 'PM audience. Education focus. | Check if networking time is included or just education. | Watch bomany.org | Apr 22'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'BOMA NY Energy Action Day');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NY Building Foundation: 18th Annual Premier Wine Dinner', 'NY Building Congress', 'PENDING_APPROVAL', 'DISCUSS', '2026-04-22', 'NYC (TBD)', 'https://www.buildingcongress.com/events/', NULL, NULL, false, 'High-level networking at intimate wine dinner. Relationship-building format. | Likely $200-400/seat. Worth it if senior contacts are priority. | Watch buildingcongress.com for pricing | Apr 22'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NY Building Foundation: 18th Annual Premier Wine Dinner');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Bisnow: Brooklyn State of the Market', 'Bisnow', 'APPROVED', 'GO', '2026-04-23', '25 Kent Ave, Floor 2, Brooklyn NY 11249', 'https://www.bisnow.com/events/new-york/state-of-market/brooklyn-state-of-the-market-10177', 130.0, 130.0, false, 'Cross-sector audience. Policy, rezoning, capital flows. | $130 is CHEAPEST Bisnow event. Great value. | Register Natalia | Apr 23, 8am-11:30am'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Bisnow: Brooklyn State of the Market');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NYBMA 104th Grand Ball', 'NYBMA', 'PENDING_APPROVAL', 'DISCUSS', '2026-04-25', 'Capitale, 130 Bowery, NYC 10013', 'https://www.nybma.org', 475.0, 475.0, false, 'NYBMA = NYC building managers. Core GLE referral audience (PMs, supers). | $475 is steep. But building managers ARE your people. Ticket deadline Apr 4. | Decision needed by Apr 4 — tickets limited | Apr 25, 6pm-11pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NYBMA 104th Grand Ball');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'BOMA NY Emerging Leaders: 5 Iron Golf', 'BOMA NY', 'PENDING_APPROVAL', 'DISCUSS', '2026-04-30', '5 Iron Golf, NYC', 'https://www.bomany.org/2026-upcoming-events-calendar.html', NULL, NULL, true, 'Emerging Leaders = future PMs. Relaxed networking. | Good if targeting younger PM audience. Requires BOMA membership. | Check if Natalia qualifies as EL ($225/yr) | Apr 30'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'BOMA NY Emerging Leaders: 5 Iron Golf');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'CRE RED Awards — New York City', 'RED Awards', 'PENDING_APPROVAL', 'DISCUSS', '2026-04-30', '101 Park Avenue, NYC', 'https://www.redawards.nyc', 895.0, 895.0, false, 'Elite CRE awards. Featured on Netflix. Top developers + brokers in one room. | Chris said "sounds good." $895 is premium but room is exactly right. SAME NIGHT as BOMA EL — pick one. | Decision needed — conflicts with BOMA EL same night | Apr 30, 7pm-10:30pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'CRE RED Awards — New York City');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, '105th Anniversary NYBC Leadership Awards Luncheon', 'NY Building Congress', 'APPROVED', 'GO', '2026-05-06', 'NYC (TBD — likely Hilton Midtown)', 'https://www.buildingcongress.com/events/', 150.0, 150.0, false, '105th anniversary = milestone event. Awards attract top industry decision-makers. | Flagship NYBC event. Price not posted but worth it at any level. | Register when pricing opens | May 6'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = '105th Anniversary NYBC Leadership Awards Luncheon');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'The Real Deal NYC Forum', 'The Real Deal', 'APPROVED', 'GO', '2026-05-06', 'Metropolitan Pavilion, NYC', 'https://events.therealdeal.com/new-york/home', 175.0, 175.0, false, '$175 GA. 3,000+ attendees. 50+ sponsors. Major deal-making event. | PRIORITY. $100 add-on for Power Breakfast. Register early — sells out. | Register Natalia — GA $175 | May 6'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'The Real Deal NYC Forum');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Bisnow: NYC AI & Technology Event', 'Bisnow', 'SKIPPED', 'SKIP', '2026-05-13', '7 World Trade Center, 40th Fl, 250 Greenwich St, NYC 10007', 'https://www.bisnow.com/events/new-york/proptech/new-york-ai-technology-event-10201', 130.0, 130.0, false, 'Tech-focused. Workforce automation, AI ops. | Wrong audience for GLE. Skip. | No action | May 13, 8am-11:30am'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Bisnow: NYC AI & Technology Event');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Bisnow: NYC Investment & Lending Conference', 'Bisnow', 'PENDING_APPROVAL', 'DISCUSS', '2026-05-27', 'NYC (venue TBD)', 'https://www.bisnow.com/events/new-york/capital-markets/new-york-investment-lending-conference-10198', 159.0, 159.0, false, 'Capital markets intel. Financing + debt + equity strategies. | $126 is reasonable. More intel than direct BD — but good for conversation cards. | $159.65  with tax and fees | May 27, 8am-11:45am'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Bisnow: NYC Investment & Lending Conference');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'REBNY Commercial Brokerage Event', 'REBNY', 'APPROVED', 'GO', '2026-06-04', 'NYC', 'https://www.rebny.com/events/', 54.0, 54.0, false, 'Brokers = #1 referral source. | Non-negotiable. | Watch rebny.com/events | June 4, 6pm-10pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'REBNY Commercial Brokerage Event');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Bisnow: National Energy & Sustainability Conference', 'Bisnow', 'SKIPPED', 'SKIP', '2026-06-03', 'NYC (venue TBD)', 'https://www.bisnow.com/events/new-york/sustainability-climate/national-energy-sustainability-conference-10176', 170.0, 170.0, false, 'Niche energy focus. Not GLE audience. | Skip. Wrong audience. | No action | Jun 3, 8am-12:30pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Bisnow: National Energy & Sustainability Conference');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'AI Now and Next: Elevating the Modern Professiona', 'REBNY', 'PENDING_APPROVAL', 'DISCUSS', '2026-06-06', 'Selene NYC 100 E 53rd St, New York, NY 10022', NULL, 100.0, 100.0, false, '2026-06-08 18:00:00'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'AI Now and Next: Elevating the Modern Professiona');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, '2026 Spring Golf Classic & Tennis Tournament', 'BOMANY', 'PENDING_APPROVAL', 'DISCUSS', '2026-06-15', 'Glen Head Country Club
240 Glen Cove Rd
Glen Head , NY 11545', 'https://web.bomany.org/atlas/events/2026-spring-golf-classic-tennis-tournament-155/details', 200.0, 200.0, false, 'June 15,  5:30PM-7PM'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = '2026 Spring Golf Classic & Tennis Tournament');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, '20th Annual Commercial Management Leadership Breakfast Awards', 'REBNY', 'PENDING_APPROVAL', 'DISCUSS', '2026-06-11', '583 Park Avenue', 'https://www.rebny.com/events/', 125.0, 125.0, false, 'June 11, 7:30AM-10AM'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = '20th Annual Commercial Management Leadership Breakfast Awards');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NY Building Congress: June Construction Industry Breakfast', 'NY Building Congress', 'APPROVED', 'GO', '2026-06-16', NULL, 'https://www.buildingcongress.com/events/', 300.0, 300.0, false, 'Second NYBC breakfast of the year. Same great audience. | By June you know if NYBC is worth it from March breakfast. | Register Natalia; Done SD; | Jun 16, 8am-9:30AM'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NY Building Congress: June Construction Industry Breakfast');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NAIOP NYC Summer Networking', 'NAIOP NYC/Museum of the City of New York', 'APPROVED', 'GO', '2026-06-19', 'New York, NY 10065', 'https://naiopnycmetro.org/     and https://www.mcny.org/event/world-cup-watch-party-usa-vs-australia', 0, 0, true, 'Developer-heavy crowd. | No events currently posted on NAIOP NYC Metro. Watch for updates. Seems to be free as of 6.2.2026 SD | Check naiopnycmetro.org monthly | June 19, 1pm-5pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NAIOP NYC Summer Networking');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Summer Networking', 'Various', 'APPROVED', 'GO', '2026-07-07', 'Starrett-Lehigh: The Yacht Club
212 12th Ave
New York NY, 10010', 'Eamil sent to natalia https://www.bisnow.com/events/new-york/other/america250-new-york-summer-cocktail-10180', 78.0, 78.0, false, 'Lighter month. | Natalia picks from network invites. | Monitor LinkedIn | 2026-07-15 17:30:00'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Summer Networking');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'Data Center Capital Markets Summit', 'Bisnow', 'PENDING_APPROVAL', 'DISCUSS', '2026-07-07', 'New York Marriott Marquis
1535 Broadway
New York, NY 10036', 'https://www.bisnow.com/events/new-york/data-center/data-center-capital-markets-summit-10023', 334.0, 334.0, false, 'AI & Cloud & Migration Enterprise IT | 2026-07-16 07:30:00'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'Data Center Capital Markets Summit');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'LIGHT MONTH — Focus on Coffees', NULL, 'PENDING_APPROVAL', 'DISCUSS', '2026-08-01', NULL, NULL, NULL, NULL, false, 'Coffee meetings with existing contacts. | No events. Relationship maintenance. | Schedule coffees for Natalia'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'LIGHT MONTH — Focus on Coffees');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, '2026 Golf Outing Cocktail & Dinner Reception Only', 'Corenet', 'PENDING_APPROVAL', 'DISCUSS', '2026-08-03', 'Old Oaks Country Club – Scramble Format

3100 Purchase Street, Purchase, NY', 'https://connect.corenetglobal.org/Registration/Express/17962', 450.0, 0.0, false, 'Aug 3, 5pm-8pm (Dinner & network starts at  5pm)'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = '2026 Golf Outing Cocktail & Dinner Reception Only');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'WBC 22nd Annual Golf & Tennis Outing', 'WBC', 'PENDING_APPROVAL', 'DISCUSS', '2026-08-17', 'NYC area (TBD)', 'https://www.wbcnyc.org/upcoming-events-wbc/8172026-22nd-annual-golf-and-tennis-outing', NULL, NULL, false, 'Relaxed summer networking. Sports event. | Fun format. Good relationship building. Need WBC membership ($500/yr)? | Monitor wbcnyc.org for pricing | Aug 17'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'WBC 22nd Annual Golf & Tennis Outing');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'REBNY Fall Networking Event', 'REBNY', 'APPROVED', 'GO', '2026-09-09', 'Citi Field
41 Seaver Way
Flusing, NY 11368', 'https://www.rebny.com/events/', NULL, NULL, true, 'Fall kickoff. Must-attend. | Non-negotiable. | Watch rebny.com/events | September 9,  6pm-10pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'REBNY Fall Networking Event');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'AIA NY Fall Event', 'AIA NY', 'APPROVED', 'GO', '2026-09-01', 'Center for Architecture, NYC', 'https://www.aiany.org/membership/', 0, 0, false, 'Architects = 40% of GLE business. | AIA Allied membership ~$357/yr. Worth it for event access + credibility. | Watch aiany.org calendar | TBD'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'AIA NY Fall Event');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'CoreNet NYC 2026 REmmys Gala', 'Corenet', 'PENDING_APPROVAL', 'DISCUSS', '2026-09-24', 'TBA', NULL, NULL, NULL, false, 'Sep 24 06:00 PM to 11:00 PM'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'CoreNet NYC 2026 REmmys Gala');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NY Building Congress: Annual Golf Outing & Tennis Tournament', 'NY Building Congress', 'PENDING_APPROVAL', 'DISCUSS', '2026-09-28', 'NYC area (TBD)', 'https://www.buildingcongress.com/events/', 300.0, 300.0, false, 'NYBC golf = relationship gold. Intimate format, long conversations. | Golf outings are expensive but high ROI per contact. Decision after March breakfast. | Watch buildingcongress.com | Sep 28'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NY Building Congress: Annual Golf Outing & Tennis Tournament');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NAIOP NYC Awards / Fall Event', 'NAIOP NYC', 'APPROVED', 'GO', '2026-10-01', 'NYC (TBD)', 'https://naiopnycmetro.org/', 100.0, 200.0, true, 'Annual awards. Developer crowd. | No events currently posted. Watch for updates. | Watch naiopnycmetro.org | TBD'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NAIOP NYC Awards / Fall Event');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'CREtech New York 2026', 'CREtech', 'PENDING_APPROVAL', 'DISCUSS', '2026-10-20', 'Javits Center NYC', 'https://discover.cretech.com/cretech-new-york-register', 0, 0, false, 'VERIFIED: Free for qualified RE owners who commit to 8 meetings. | CHECK: Does GLE qualify for free hosted buyer pass? | Apply for hosted buyer pass | Oct 20-21'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'CREtech New York 2026');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NY Building Congress: October Construction Industry Breakfast', 'NY Building Congress', 'APPROVED', 'GO', '2026-10-22', 'New York Hilton Midtown (expected)', 'https://www.buildingcongress.com/events/', 95.0, 150.0, false, 'Fall breakfast. Great Q4 kickoff networking. | Third NYBC breakfast. By now you have strong relationships here. | Register Natalia | Oct 22, 8am'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NY Building Congress: October Construction Industry Breakfast');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'BOMA NY Fall Event', 'BOMA NY', 'APPROVED', 'GO', '2026-10-01', 'NYC (TBD)', 'https://www.bomany.org/2026-upcoming-events-calendar.html', NULL, NULL, true, 'Q4 BOMA. Must-attend. | Non-negotiable. | Watch bomany.org calendar | TBD'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'BOMA NY Fall Event');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'WBC Annual Gala Night', 'WBC', 'PENDING_APPROVAL', 'DISCUSS', '2026-11-05', 'Guastavino''s, NYC', 'https://www.wbcnyc.org/upcoming-events-wbc/110526-wbc-annual-gala-night', NULL, NULL, false, 'WBC signature annual event. High-level networking. | Price not posted. Galas can run $200-500. Worth it? | Monitor wbcnyc.org for pricing | Nov 5, 5:15pm-10pm'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'WBC Annual Gala Night');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'REBNY Commercial Holiday Luncheon', 'REBNY', 'APPROVED', 'GO', '2026-12-01', 'NYC (TBD)', 'https://www.rebny.com/events/', NULL, NULL, true, 'Best holiday event. Relationship gold. | Non-negotiable. | Register immediately when posted | TBD'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'REBNY Commercial Holiday Luncheon');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NY Building Congress: 2026 Industry Recognition Gala', 'NY Building Congress', 'PENDING_APPROVAL', 'DISCUSS', '2026-12-03', 'NYC (TBD)', 'https://www.buildingcongress.com/events/', 250.0, 250.0, false, 'Year-end gala. Awards + networking. Formal event. | Only if NYBC breakfasts proved valuable. Galas are $$ but high-level. | Watch buildingcongress.com | Dec 3'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NY Building Congress: 2026 Industry Recognition Gala');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'NAIOP NYC Holiday Party', 'NAIOP NYC', 'APPROVED', 'GO', '2026-12-01', 'NYC (TBD)', 'https://naiopnycmetro.org/', 50.0, 100.0, true, 'Year-end touchpoint. | Not yet posted. | Watch naiopnycmetro.org | TBD'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'NAIOP NYC Holiday Party');

INSERT INTO public.bd_events (company_id, name, category, status, priority, start_date, location, source_url, cost_member, cost_nonmember, included_in_membership, notes)
SELECT c.id, 'WBC Holiday Party', 'WBC', 'PENDING_APPROVAL', 'DISCUSS', '2026-12-09', 'NYC (TBD)', 'https://www.wbcnyc.org/upcoming-events-wbc/1292026-holiday-party', NULL, NULL, false, 'Year-end WBC networking. | Only if earlier WBC events proved valuable. | Monitor wbcnyc.org | Dec 9'
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.bd_events e WHERE e.company_id = c.id AND e.name = 'WBC Holiday Party');
