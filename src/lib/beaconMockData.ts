// ===== Beacon Mock Data & Types =====

// --- Types ---
export type KBCategory = "processes" | "dob_notices" | "building_code_2022" | "building_code_1968" | "building_code_general" | "zoning" | "mdl" | "hmc" | "historical" | "rcny" | "communication";
export type KBStatus = "active" | "needs_review";
export type BBStatus = "ACTIVE" | "SUPERSEDED" | "RESCINDED";
export type BBCategory = "Energy" | "Structural" | "Fire Protection" | "Professional Certification" | "Zoning" | "General" | "Zoning/Loft";
export type ContentStatus = "incoming" | "scored" | "draft" | "published" | "rejected";
export type ContentType = "blog" | "newsletter" | "internal";
export type ConfidenceLevel = "high" | "medium" | "low";
export type CardType = "general" | "property_lookup" | "filing_question" | "code_question";

export interface KnowledgeFile {
  id: string;
  filename: string;
  title: string;
  category: KBCategory;
  last_updated: string;
  chunk_count: number;
  status: KBStatus;
  tags: string[];
  has_verify_tags: boolean;
  source?: string;
  applicable_codes?: string[];
  content_preview: string;
}

export interface BuildingsBulletin {
  id: string;
  bb_number: string;
  title: string;
  issue_date: string;
  status: BBStatus;
  supersedes: string[];
  superseded_by: string | null;
  category: BBCategory;
  applies_to: string;
  key_takeaway: string;
  in_knowledge_base: boolean;
  reference_count: number;
}

export interface ContentCandidate {
  id: string;
  title: string;
  source: string;
  relevance_score: number;
  content_type: ContentType;
  status: ContentStatus;
  draft_content: string;
  related_questions_count: number;
  created_at: string;
}

export interface RAGSource {
  file: string;
  relevance: number;
}

export interface BeaconConversation {
  id: string;
  user: string;
  user_avatar?: string;
  space: string;
  timestamp: string;
  question: string;
  response: string;
  confidence: ConfidenceLevel;
  rag_sources: RAGSource[];
  card_type: CardType;
  is_correct?: boolean;
  correction?: string;
}

export interface FeedbackEntry {
  id: string;
  type: "correction" | "suggestion" | "tip";
  user: string;
  timestamp: string;
  original_question: string;
  text: string;
  status: "pending" | "applied" | "dismissed";
}

export interface AnalyticsSummary {
  total_questions: number;
  avg_confidence: number;
  kb_files: number;
  low_confidence_count: number;
  daily_counts: { date: string; count: number }[];
  category_counts: { category: string; count: number }[];
  confidence_distribution: { level: string; count: number }[];
  top_questions: { question: string; count: number }[];
  corrections_count: number;
  suggestions_count: number;
}

// --- Category labels ---
export const KB_CATEGORY_LABELS: Record<KBCategory, string> = {
  processes: "Processes",
  dob_notices: "DOB Notices",
  building_code_2022: "Building Code 2022",
  building_code_1968: "Building Code 1968",
  building_code_general: "Building Code (General)",
  zoning: "Zoning",
  mdl: "MDL",
  hmc: "HMC",
  historical: "Historical",
  rcny: "RCNY",
  communication: "Communication",
};

// Helper to generate title from filename
function titleFromFilename(fn: string): string {
  return fn
    .replace(/\.md$/, "")
    .replace(/_/g, " ")
    .replace(/\b(bb|mdl|hmc|rcny|dob|bis|nb|alt|co|tco|paa|pa|bpp|ecb|fdny|dot|oer|mta|lpc|swo|tpa|gle|rcny|dhcr|rpapl)\b/gi, (m) => m.toUpperCase())
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^(\d{4})[\s_](\d{2})[\s_]/, "$1-$2: ")
    .trim();
}

function kbFile(id: string, filename: string, category: KBCategory, opts: Partial<KnowledgeFile> = {}): KnowledgeFile {
  return {
    id,
    filename,
    title: opts.title || titleFromFilename(filename),
    category,
    last_updated: opts.last_updated || "2026-01-15",
    chunk_count: opts.chunk_count || Math.floor(Math.random() * 10) + 4,
    status: opts.status || "active",
    tags: opts.tags || [],
    has_verify_tags: opts.has_verify_tags || false,
    content_preview: opts.content_preview || `Content from ${filename}`,
    source: opts.source,
    applicable_codes: opts.applicable_codes,
  };
}

// --- Real Knowledge Base Files (87 total) ---
export const mockKnowledgeFiles: KnowledgeFile[] = [
  // === Processes (44 files) ===
  kbFile("kb-1", "after_hours_permit_guide.md", "processes", { chunk_count: 5, tags: ["after-hours", "permit"] }),
  kbFile("kb-2", "alt1_filing_guide.md", "processes", { title: "Alt-1 Filing Guide", chunk_count: 8, tags: ["alt-1", "alteration", "major"] }),
  kbFile("kb-3", "alt2_filing_guide.md", "processes", { title: "Alt-2 Filing Guide", chunk_count: 7, tags: ["alt-2", "alteration", "minor"] }),
  kbFile("kb-4", "bpp_approval_guide.md", "processes", { title: "BPP Approval Guide", chunk_count: 6, tags: ["bpp", "approval"] }),
  kbFile("kb-5", "co_tco_guide.md", "processes", { title: "CO/TCO Guide", chunk_count: 9, tags: ["co", "tco", "certificate-of-occupancy"] }),
  kbFile("kb-6", "demolition_filing_guide.md", "processes", { chunk_count: 8, tags: ["demolition", "filing", "safety"] }),
  kbFile("kb-7", "determination_filing_guide.md", "processes", { chunk_count: 5, tags: ["determination", "filing"] }),
  kbFile("kb-8", "dhcr_rent_regulation_guide.md", "processes", { title: "DHCR Rent Regulation Guide", chunk_count: 6, tags: ["dhcr", "rent-regulation"] }),
  kbFile("kb-9", "dob_build_vs_bis_guide.md", "processes", { title: "DOB NOW vs BIS Guide", chunk_count: 7, tags: ["dob-now", "bis", "comparison"] }),
  kbFile("kb-10", "dob_fees_penalties_guide.md", "processes", { title: "DOB Fees & Penalties Guide", chunk_count: 8, tags: ["fees", "penalties", "dob"] }),
  kbFile("kb-11", "dob_violation_types_guide.md", "processes", { title: "DOB Violation Types Guide", chunk_count: 7, tags: ["violations", "types"] }),
  kbFile("kb-12", "dot_permits_guide.md", "processes", { title: "DOT Permits Guide", chunk_count: 6, tags: ["dot", "permits"] }),
  kbFile("kb-13", "ecb_violation_resolution_guide.md", "processes", { title: "ECB Violation Resolution Guide", chunk_count: 8, tags: ["ecb", "violations", "resolution"] }),
  kbFile("kb-14", "egress_requirements_guide.md", "processes", { chunk_count: 9, tags: ["egress", "means-of-egress"] }),
  kbFile("kb-15", "energy_code_compliance_guide.md", "processes", { chunk_count: 10, status: "needs_review", has_verify_tags: true, tags: ["energy-code", "nycecc", "compliance"], content_preview: "Guide for NYCECC compliance including [VERIFY] updated 2025 energy code thresholds..." }),
  kbFile("kb-16", "equipment_use_permit_guide.md", "processes", { chunk_count: 5, tags: ["equipment", "permit"] }),
  kbFile("kb-17", "fdny_filing_guide.md", "processes", { title: "FDNY Filing Guide", chunk_count: 7, tags: ["fdny", "filing"] }),
  kbFile("kb-18", "fdny_rooftop_access_guide.md", "processes", { title: "FDNY Rooftop Access Guide", chunk_count: 5, tags: ["fdny", "rooftop"] }),
  kbFile("kb-19", "fdny_withdrawal_timelines_gle_data.md", "processes", { title: "FDNY Withdrawal Timelines (GLE Data)", chunk_count: 4, tags: ["fdny", "withdrawal", "timelines"] }),
  kbFile("kb-20", "fire_alarm_approval_guide.md", "processes", { chunk_count: 6, tags: ["fire-alarm", "approval"] }),
  kbFile("kb-21", "fire_protection_plan_guide.md", "processes", { chunk_count: 7, tags: ["fire-protection", "plan"] }),
  kbFile("kb-22", "how_to_remove_pa_permit.md", "processes", { title: "How to Remove PA Permit", chunk_count: 4, tags: ["pa", "permit", "removal"] }),
  kbFile("kb-23", "inspection_signoff_guide.md", "processes", { chunk_count: 6, tags: ["inspection", "signoff"] }),
  kbFile("kb-24", "landmarks_lpc_guide.md", "processes", { title: "Landmarks/LPC Guide", chunk_count: 6, tags: ["landmarks", "lpc", "historic"] }),
  kbFile("kb-25", "letter_of_no_objection_guide.md", "processes", { chunk_count: 5, tags: ["letter", "no-objection"] }),
  kbFile("kb-26", "misc_services_guide.md", "processes", { chunk_count: 4, tags: ["misc", "services"] }),
  kbFile("kb-27", "mta_approval_guide.md", "processes", { title: "MTA Approval Guide", chunk_count: 5, tags: ["mta", "approval"] }),
  kbFile("kb-28", "nb_filing_guide.md", "processes", { title: "NB Filing Guide", chunk_count: 12, tags: ["new-building", "dob-now", "filing"] }),
  kbFile("kb-29", "objection_review_ai1_process.md", "processes", { chunk_count: 6, tags: ["objection", "review", "ai1"] }),
  kbFile("kb-30", "objections_plan_exam_guide.md", "processes", { chunk_count: 7, tags: ["objections", "plan-exam"] }),
  kbFile("kb-31", "occupancy_classification_guide.md", "processes", { chunk_count: 8, tags: ["occupancy", "classification"] }),
  kbFile("kb-32", "oer_approval_guide.md", "processes", { title: "OER Approval Guide", chunk_count: 5, tags: ["oer", "approval"] }),
  kbFile("kb-33", "pa_place_of_assembly_guide.md", "processes", { title: "PA Place of Assembly Guide", chunk_count: 7, tags: ["place-of-assembly", "pa"] }),
  kbFile("kb-34", "paa_post_approval_amendment_guide.md", "processes", { title: "PAA Post Approval Amendment Guide", chunk_count: 5, tags: ["paa", "post-approval", "amendment"] }),
  kbFile("kb-35", "paa_vs_alt_decision_tree.md", "processes", { title: "PAA vs Alt Decision Tree", chunk_count: 4, tags: ["paa", "alt", "decision-tree"] }),
  kbFile("kb-36", "permit_types_when_needed_guide.md", "processes", { chunk_count: 8, tags: ["permit-types", "when-needed"] }),
  kbFile("kb-37", "rpapl_881_access_request_checklist.md", "processes", { title: "RPAPL 881 Access Request Checklist", chunk_count: 4, tags: ["rpapl", "access-request"] }),
  kbFile("kb-38", "solar_application_guide.md", "processes", { chunk_count: 5, tags: ["solar", "application"] }),
  kbFile("kb-39", "sprinkler_requirements_guide.md", "processes", { chunk_count: 6, tags: ["sprinkler", "requirements"] }),
  kbFile("kb-40", "supersede_withdrawal_reinstatement_guide.md", "processes", { chunk_count: 5, tags: ["supersede", "withdrawal", "reinstatement"] }),
  kbFile("kb-41", "swo_resolution_guide.md", "processes", { title: "SWO Resolution Guide", chunk_count: 6, tags: ["swo", "stop-work-order"] }),
  kbFile("kb-42", "tpa_filing_guide.md", "processes", { title: "TPA Filing Guide", chunk_count: 5, tags: ["tpa", "filing"] }),
  kbFile("kb-43", "vacate_order_removal_guide.md", "processes", { chunk_count: 5, tags: ["vacate-order", "removal"] }),
  kbFile("kb-44", "zoning_common_questions_guide.md", "processes", { chunk_count: 6, tags: ["zoning", "common-questions"] }),

  // === DOB Notices (17 files) ===
  kbFile("kb-45", "bb_2022_007_code_applicability.md", "dob_notices", { title: "BB 2022-007: Code Applicability", chunk_count: 6, tags: ["buildings-bulletin", "code-applicability"] }),
  kbFile("kb-46", "bb_2024_001_fire_alarm_2022_code.md", "dob_notices", { title: "BB 2024-001: Fire Alarm Under 2022 Code", chunk_count: 5, tags: ["buildings-bulletin", "fire-alarm"] }),
  kbFile("kb-47", "bb_2025_002_amended_co_city_of_yes.md", "dob_notices", { title: "BB 2025-002: Amended CO — City of Yes", chunk_count: 4, tags: ["buildings-bulletin", "city-of-yes", "co"] }),
  kbFile("kb-48", "bb_2025_005_professional_certification.md", "dob_notices", { title: "BB 2025-005: Professional Certification", chunk_count: 4, tags: ["buildings-bulletin", "professional-cert"] }),
  kbFile("kb-49", "bb_2025_011_structural_filing.md", "dob_notices", { title: "BB 2025-011: Structural Filing", chunk_count: 5, tags: ["buildings-bulletin", "structural"] }),
  kbFile("kb-50", "bb_2025_012_loft_board_compliance.md", "dob_notices", { title: "BB 2025-012: Loft Board Compliance", chunk_count: 4, tags: ["buildings-bulletin", "loft-board"] }),
  kbFile("kb-51", "bb_2026_005_energy_code_applicability.md", "dob_notices", { title: "BB 2026-005: Energy Code Applicability", chunk_count: 5, tags: ["buildings-bulletin", "energy-code", "nycecc"] }),
  kbFile("kb-52", "bb_master_index.md", "dob_notices", { title: "BB Master Index", chunk_count: 8, tags: ["buildings-bulletin", "index", "reference"] }),
  kbFile("kb-53", "dob_bulletin_2026_004_location_systems.md", "dob_notices", { title: "DOB Bulletin 2026-004: Location Systems", chunk_count: 4, tags: ["bulletin", "location-systems"] }),
  kbFile("kb-54", "dob_notice_2026_fee_updates.md", "dob_notices", { title: "DOB Notice 2026: Fee Updates", chunk_count: 3, tags: ["notice", "fees"] }),
  kbFile("kb-55", "2016_03_demolition_submittal_exemptions.md", "dob_notices", { title: "2016-03: Demolition Submittal Exemptions", chunk_count: 4, tags: ["policy-memo", "demolition"] }),
  kbFile("kb-56", "2025_12_buildings_after_hours_2026_schedule.md", "dob_notices", { title: "2025-12: After Hours 2026 Schedule", chunk_count: 3, tags: ["service-notice", "after-hours"] }),
  kbFile("kb-57", "2026_01_construction_cost_reporting.md", "dob_notices", { title: "2026-01: Construction Cost Reporting", chunk_count: 3, tags: ["service-notice", "cost-reporting"] }),
  kbFile("kb-58", "2026_01_parking_facade_fee_updates.md", "dob_notices", { title: "2026-01: Parking/Facade Fee Updates", chunk_count: 3, tags: ["service-notice", "fees"] }),
  kbFile("kb-59", "2026_01_sidewalk_shed_ll48_ll51.md", "dob_notices", { title: "2026-01: Sidewalk Shed LL48/LL51", chunk_count: 4, tags: ["service-notice", "sidewalk-shed"] }),
  kbFile("kb-60", "2026_01_structural_permit_restrictions.md", "dob_notices", { title: "2026-01: Structural Permit Restrictions", chunk_count: 3, tags: ["service-notice", "structural"] }),
  kbFile("kb-61", "2026_01_bb2026_003_bim_compliance.md", "dob_notices", { title: "2026-01: BB 2026-003 BIM Compliance", chunk_count: 4, tags: ["technical-bulletin", "bim"] }),

  // === Historical (8 files) ===
  kbFile("kb-62", "2006_04_recon_factory_conversion_305_e140th_bronx.md", "historical", { title: "2006-04: Recon — Factory Conversion, 305 E 140th, Bronx", chunk_count: 5 }),
  kbFile("kb-63", "2006_08_recon_test_kitchen_office.md", "historical", { title: "2006-08: Recon — Test Kitchen/Office", chunk_count: 4 }),
  kbFile("kb-64", "2006_11_acceptance_tempered_glass_skylight.md", "historical", { title: "2006-11: Acceptance — Tempered Glass Skylight", chunk_count: 3 }),
  kbFile("kb-65", "2007_05_recon_sidewalk_slope_176_mulberry.md", "historical", { title: "2007-05: Recon — Sidewalk Slope, 176 Mulberry", chunk_count: 4 }),
  kbFile("kb-66", "2007_11_acceptance_fire_alarm_tco_620_w30th.md", "historical", { title: "2007-11: Acceptance — Fire Alarm TCO, 620 W 30th", chunk_count: 3 }),
  kbFile("kb-67", "2007_11_precon_triplex_381_broome.md", "historical", { title: "2007-11: Precon — Triplex, 381 Broome", chunk_count: 4 }),
  kbFile("kb-68", "2007_12_recon_drywell_63_20_commonwealth_queens.md", "historical", { title: "2007-12: Recon — Drywell, 63-20 Commonwealth, Queens", chunk_count: 4 }),
  kbFile("kb-69", "2021_02_dob_webinar_co_notes.md", "historical", { title: "2021-02: DOB Webinar CO Notes", chunk_count: 5 }),

  // === MDL (6 files) ===
  kbFile("kb-70", "mdl_277_occupancy_permitted.md", "mdl", { title: "MDL §277: Occupancy Permitted", chunk_count: 5 }),
  kbFile("kb-71", "mdl_278_application_of_other_provisions.md", "mdl", { title: "MDL §278: Application of Other Provisions", chunk_count: 4 }),
  kbFile("kb-72", "mdl_53_fire_escapes.md", "mdl", { title: "MDL §53: Fire Escapes", chunk_count: 6 }),
  kbFile("kb-73", "mdl_article3_light_ventilation_fire.md", "mdl", { title: "MDL Article 3: Light, Ventilation & Fire", chunk_count: 8 }),
  kbFile("kb-74", "mdl_article6_converted_dwellings.md", "mdl", { title: "MDL Article 6: Converted Dwellings", chunk_count: 7 }),
  kbFile("kb-75", "mdl_article7c_loft_law.md", "mdl", { title: "MDL Article 7-C: Loft Law", chunk_count: 9 }),

  // === Building Code 2022 (3 files) ===
  kbFile("kb-76", "bc_ch10_means_of_egress.md", "building_code_2022", { title: "BC Ch. 10: Means of Egress", chunk_count: 12, tags: ["2022-code", "egress"] }),
  kbFile("kb-77", "bc_ch7_fire_smoke_protection.md", "building_code_2022", { title: "BC Ch. 7: Fire & Smoke Protection", chunk_count: 10, tags: ["2022-code", "fire-protection"] }),
  kbFile("kb-78", "bc_ch9_fire_protection_systems.md", "building_code_2022", { title: "BC Ch. 9: Fire Protection Systems", chunk_count: 8, tags: ["2022-code", "fire-protection-systems"] }),

  // === Building Code General (2 files) ===
  kbFile("kb-79", "1_rcny_101_14_permit_exemptions.md", "building_code_general", { title: "1 RCNY §101-14: Permit Exemptions", chunk_count: 7 }),
  kbFile("kb-80", "sprinkler_standpipe_color_coding.md", "building_code_general", { title: "Sprinkler/Standpipe Color Coding", chunk_count: 4 }),

  // === Building Code 1968 (1 file) ===
  kbFile("kb-81", "bc_1968_subchapter6_egress.md", "building_code_1968", { title: "BC 1968 Subchapter 6: Egress", chunk_count: 14, tags: ["1968-code", "egress"] }),

  // === Zoning (3 files) ===
  kbFile("kb-82", "zr_article2_ch2_use_regulations.md", "zoning", { title: "ZR Article 2, Ch. 2: Use Regulations", chunk_count: 10, tags: ["zoning", "use-regulations"] }),
  kbFile("kb-83", "zr_article2_ch3_residential_bulk.md", "zoning", { title: "ZR Article 2, Ch. 3: Residential Bulk", chunk_count: 8, tags: ["zoning", "residential", "bulk"] }),
  kbFile("kb-84", "zr_article3_ch2_commercial_use_regulations.md", "zoning", { title: "ZR Article 3, Ch. 2: Commercial Use Regulations", chunk_count: 9, tags: ["zoning", "commercial"] }),

  // === HMC (1 file) ===
  kbFile("kb-85", "hmc_maintenance_code_overview.md", "hmc", { title: "HMC: Maintenance Code Overview", chunk_count: 10, tags: ["hmc", "housing-maintenance"] }),

  // === RCNY (1 file) ===
  kbFile("kb-86", "rcny_1_15_fire_escapes.md", "rcny", { title: "RCNY §1-15: Fire Escapes", chunk_count: 6, tags: ["rcny", "fire-escapes"] }),

  // === Communication (1 file) ===
  kbFile("kb-87", "communication_pattern_violation_inquiry_outside_scope.md", "communication", { title: "Communication Pattern: Violation Inquiry Outside Scope", chunk_count: 4, tags: ["communication", "templates", "violations"] }),
];

// --- Real Buildings Bulletins ---
export const mockBulletins: BuildingsBulletin[] = [
  { id: "bb-1", bb_number: "2026-005", title: "NYCECC Applicability for 2025 Energy Code", issue_date: "2026-01-15", status: "ACTIVE", supersedes: ["2020-002"], superseded_by: null, category: "Energy", applies_to: "2022 Code", key_takeaway: "Establishes energy code compliance path for 2025 NYCECC — all new filings after 3/1/2026 must comply.", in_knowledge_base: true, reference_count: 45 },
  { id: "bb-2", bb_number: "2025-005", title: "Professional Certification (Directive 14)", issue_date: "2025-06-01", status: "ACTIVE", supersedes: ["2016-010", "OPPN #1/04"], superseded_by: null, category: "Professional Certification", applies_to: "All", key_takeaway: "Updated requirements for professionally certified applications including new audit procedures.", in_knowledge_base: true, reference_count: 38 },
  { id: "bb-3", bb_number: "2025-011", title: "Structural Filing Requirements", issue_date: "2025-09-01", status: "ACTIVE", supersedes: [], superseded_by: null, category: "Structural", applies_to: "2022 Code", key_takeaway: "New structural filing requirements under the 2022 code.", in_knowledge_base: true, reference_count: 20 },
  { id: "bb-4", bb_number: "2025-012", title: "Loft Board IMD Compliance", issue_date: "2025-10-01", status: "ACTIVE", supersedes: [], superseded_by: null, category: "Zoning/Loft", applies_to: "All", key_takeaway: "Compliance requirements for Loft Board interim multiple dwellings.", in_knowledge_base: true, reference_count: 15 },
  { id: "bb-5", bb_number: "2025-002", title: "Amended CO for City of Yes", issue_date: "2025-03-01", status: "ACTIVE", supersedes: [], superseded_by: null, category: "Zoning", applies_to: "All", key_takeaway: "Amended Certificate of Occupancy procedures under City of Yes zoning changes.", in_knowledge_base: true, reference_count: 25 },
  { id: "bb-6", bb_number: "2025-001", title: "Boiler Inspection Requirements", issue_date: "2025-01-15", status: "ACTIVE", supersedes: ["2022-006"], superseded_by: null, category: "Fire Protection", applies_to: "Both", key_takeaway: "Updated boiler inspection intervals and reporting requirements for all buildings.", in_knowledge_base: true, reference_count: 22 },
  { id: "bb-7", bb_number: "2025-006", title: "ADU Accessory Dwelling Units", issue_date: "2025-08-01", status: "RESCINDED", supersedes: [], superseded_by: null, category: "Zoning", applies_to: "All", key_takeaway: "RESCINDED — ADU filing procedures withdrawn pending new legislation.", in_knowledge_base: false, reference_count: 5 },
  { id: "bb-8", bb_number: "2024-001", title: "Fire Alarm Systems Under 2022 Code", issue_date: "2024-03-01", status: "ACTIVE", supersedes: ["2015-025"], superseded_by: null, category: "Fire Protection", applies_to: "2022 Code", key_takeaway: "Fire alarm system requirements for buildings filed under the 2022 Construction Code.", in_knowledge_base: true, reference_count: 35 },
  { id: "bb-9", bb_number: "2023-002", title: "Smoke Control Wiring", issue_date: "2023-04-15", status: "ACTIVE", supersedes: ["2017-011"], superseded_by: null, category: "Fire Protection", applies_to: "Both", key_takeaway: "Updated wiring standards for smoke control systems in high-rise buildings.", in_knowledge_base: true, reference_count: 18 },
  { id: "bb-10", bb_number: "2022-016", title: "Bulk Rescission of Outdated Bulletins", issue_date: "2022-12-01", status: "ACTIVE", supersedes: ["2010-001", "2010-005", "2011-003", "2012-007", "2013-002", "2014-008", "2014-012", "2015-003"], superseded_by: null, category: "General", applies_to: "All", key_takeaway: "Rescinded 8 outdated bulletins no longer applicable under current codes.", in_knowledge_base: true, reference_count: 12 },
  { id: "bb-11", bb_number: "2022-007", title: "Code Applicability (1968 vs 2014 vs 2022)", issue_date: "2022-06-15", status: "ACTIVE", supersedes: [], superseded_by: null, category: "General", applies_to: "All", key_takeaway: "Clarifies which code applies to applications filed before and after 2022 code effective date.", in_knowledge_base: true, reference_count: 52 },
  // Superseded BBs
  { id: "bb-12", bb_number: "2020-002", title: "Energy Code Compliance Under NYCECC 2020", issue_date: "2020-03-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2026-005", category: "Energy", applies_to: "2014 Code", key_takeaway: "Superseded by BB 2026-005 — was the primary energy code reference for 2020 NYCECC.", in_knowledge_base: true, reference_count: 30 },
  { id: "bb-13", bb_number: "2016-010", title: "Professional Certification Procedures", issue_date: "2016-05-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2025-005", category: "Professional Certification", applies_to: "All", key_takeaway: "Superseded by BB 2025-005 — original professional cert program procedures.", in_knowledge_base: false, reference_count: 15 },
  { id: "bb-14", bb_number: "2022-006", title: "Boiler Inspection Intervals", issue_date: "2022-04-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2025-001", category: "Fire Protection", applies_to: "Both", key_takeaway: "Superseded by BB 2025-001 — original boiler inspection interval guidance.", in_knowledge_base: false, reference_count: 8 },
  { id: "bb-15", bb_number: "2015-025", title: "Fire Alarm Requirements — 2014 Code", issue_date: "2015-09-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2024-001", category: "Fire Protection", applies_to: "2014 Code", key_takeaway: "Superseded by BB 2024-001 — fire alarm requirements under the 2014 code.", in_knowledge_base: false, reference_count: 10 },
  { id: "bb-16", bb_number: "2017-011", title: "Smoke Control Wiring — Original", issue_date: "2017-07-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2023-002", category: "Fire Protection", applies_to: "2014 Code", key_takeaway: "Superseded by BB 2023-002 — original smoke control wiring standards.", in_knowledge_base: false, reference_count: 6 },
];

// --- Real Content Candidates ---
export const mockContentCandidates: ContentCandidate[] = [
  { id: "cc-1", title: "New BB 2026-005: What the 2025 Energy Code Means for Your Filings", source: "DOB Newsletter — Jan 2026", relevance_score: 92, content_type: "blog", status: "draft", draft_content: "# What the 2025 Energy Code Means for Your Filings\n\nThe DOB has issued Buildings Bulletin 2026-005, establishing new energy code compliance paths under the 2025 NYCECC...\n\n## Key Changes\n- All new filings after March 1, 2026 must comply with updated energy thresholds\n- Existing applications in progress may continue under prior energy code\n- New prescriptive path options for small residential projects\n\n## What Expediters Need to Know\n1. Review all pending energy code submissions for compliance\n2. Update TR1 forms to reference 2025 NYCECC\n3. Coordinate with energy consultants on updated calculations...", related_questions_count: 15, created_at: "2026-02-20" },
  { id: "cc-2", title: "Professional Certification Changes Under BB 2025-005", source: "DOB Newsletter — Jun 2025", relevance_score: 87, content_type: "newsletter", status: "scored", draft_content: "", related_questions_count: 8, created_at: "2026-02-18" },
  { id: "cc-3", title: "City of Yes Zoning: What Expediters Need to Know", source: "DOB Newsletter — Nov 2025", relevance_score: 78, content_type: "blog", status: "published", draft_content: "# City of Yes: What Expediters Need to Know\n\nThe City of Yes zoning text amendments represent the most significant change to NYC's zoning resolution in decades...", related_questions_count: 22, created_at: "2026-01-15" },
  { id: "cc-4", title: "Fire Alarm Requirements Changed: BB 2024-001 Guide", source: "DOB Newsletter — Mar 2024", relevance_score: 85, content_type: "internal", status: "incoming", draft_content: "", related_questions_count: 12, created_at: "2026-02-22" },
  { id: "cc-5", title: "Loft Board Compliance: New BB 2025-012 Requirements", source: "DOB Newsletter — Oct 2025", relevance_score: 74, content_type: "newsletter", status: "draft", draft_content: "# Loft Board Compliance Under BB 2025-012\n\nNew requirements for Loft Board interim multiple dwellings (IMDs) have been established...", related_questions_count: 6, created_at: "2026-02-19" },
];

// --- Real Conversations ---
export const mockConversations: BeaconConversation[] = [
  { id: "conv-1", user: "Chris Henry", space: "DM", timestamp: "2026-02-23T09:15:00Z", question: "What's the difference between Alt-1 and Alt-2?", response: "**Alt-1 (Alteration Type 1)** involves a change of use, occupancy, or exit modifications. It requires full compliance with the current building code for the affected areas.\n\n**Alt-2 (Alteration Type 2)** covers work that doesn't change the use, occupancy, or exit. It includes things like plumbing, mechanical, and interior renovation work.\n\nKey differences:\n- Alt-1 requires DOB NOW filing with full plans\n- Alt-2 can often use a simplified filing process\n- Alt-1 triggers code compliance for the entire affected area\n- Alt-2 only needs to comply for the specific work being done", confidence: "high", rag_sources: [{ file: "alt1_filing_guide.md", relevance: 0.94 }, { file: "alt2_filing_guide.md", relevance: 0.91 }, { file: "permit_types_when_needed_guide.md", relevance: 0.82 }], card_type: "general" },
  { id: "conv-2", user: "Justin", space: "Office Staff", timestamp: "2026-02-23T10:30:00Z", question: "Do I need a TR8 for this energy code filing?", response: "A TR8 (Energy Analysis) is required for most energy code filings, but it depends on the project type:\n\n- **Required**: New Buildings, Alt-1 with full floor renovations\n- **May not be required**: Alt-2 with limited scope, equipment replacements only\n\nUnder the new BB 2026-005 (effective 3/1/2026), the TR8 requirements are being updated. Check if your filing date is before or after that cutoff.", confidence: "medium", rag_sources: [{ file: "energy_code_compliance_guide.md", relevance: 0.78 }], card_type: "code_question" },
  { id: "conv-3", user: "Manny", space: "DM", timestamp: "2026-02-22T14:45:00Z", question: "Can I file a PAA on a professionally certified job?", response: "Yes, you can file a Post Approval Amendment (PAA) on a professionally certified job. However, there are important considerations:\n\n1. The PAA itself can also be professionally certified\n2. The original PE/RA who certified the job should ideally file the PAA\n3. If a different PE/RA files the PAA, they take responsibility for the entire scope\n4. Under BB 2025-005, audit procedures for PAAs on certified jobs have been updated", confidence: "high", rag_sources: [{ file: "paa_post_approval_amendment_guide.md", relevance: 0.92 }, { file: "bb_2025_005_professional_certification.md", relevance: 0.85 }], card_type: "filing_question" },
  { id: "conv-4", user: "Chris Henry", space: "Office Staff", timestamp: "2026-02-22T11:00:00Z", question: "What's the sidewalk shed renewal process?", response: "I don't have detailed information about the sidewalk shed renewal process in my current knowledge base. I'd recommend:\n\n1. Checking DOB NOW for renewal application options\n2. Contacting DOB directly for current renewal procedures\n3. Checking if any recent Buildings Bulletins address this topic\n\n*Note: This is an area where my knowledge may be incomplete. Please verify with DOB directly.*", confidence: "low", rag_sources: [], card_type: "general" },
  { id: "conv-5", user: "Justin", space: "DM", timestamp: "2026-02-21T16:20:00Z", question: "Look up 927 Broadway", response: "**927 Broadway, Manhattan**\n\n| Field | Value |\n|-------|-------|\n| BIN | 1015432 |\n| Block/Lot | 00571/0023 |\n| Zoning | C6-4A |\n| Building Class | O4 (Office) |\n| Stories | 12 |\n| Year Built | 1903 |\n| Open Violations | 3 |\n| Last Permit | NB-2024-1234 (Active) |\n\n*Data from NYC Open Data / BIS*", confidence: "high", rag_sources: [], card_type: "property_lookup" },
  { id: "conv-6", user: "Manny", space: "Project Alpha", timestamp: "2026-02-21T09:00:00Z", question: "How do I file an NB in DOB NOW?", response: "Here's the step-by-step process for filing a New Building (NB) in DOB NOW:\n\n1. ☐ Log into DOB NOW at www.nyc.gov/dobnow\n2. ☐ Select 'Jobs' → 'File New Job'\n3. ☐ Choose 'New Building' as job type\n4. ☐ Enter property address and verify BIN/Block/Lot\n5. ☐ Complete General Information section\n6. ☐ Upload required documents (plans, zoning analysis, structural)\n7. ☐ Enter all applicable Technical Reports (TR1-TR8)\n8. ☐ Assign registered design professional\n9. ☐ Pay filing fees\n10. ☐ Submit for DOB review\n\n**Required Documents**: Architectural plans, structural plans, zoning analysis, energy code compliance (TR1), and applicable special inspections.", confidence: "high", rag_sources: [{ file: "nb_filing_guide.md", relevance: 0.96 }], card_type: "filing_question" },
  { id: "conv-7", user: "Chris Henry", space: "DM", timestamp: "2026-02-20T13:30:00Z", question: "What code applies to my 1968 building renovation?", response: "For a building constructed under the 1968 code, the applicable code depends on the type of work:\n\n- **Alt-1 (change of use/occupancy)**: Must comply with the current 2022 code for affected areas\n- **Alt-2 (no use change)**: Can generally comply with the code under which the building was constructed (1968 code), but certain provisions of the 2022 code may still apply\n- **BB 2022-007** clarifies the transition rules between codes\n\nKey consideration: If the building has an existing C of O under the 1968 code, limited alterations can reference 1968 code provisions.", confidence: "high", rag_sources: [{ file: "bb_2022_007_code_applicability.md", relevance: 0.93 }, { file: "bc_1968_subchapter6_egress.md", relevance: 0.81 }], card_type: "code_question" },
  { id: "conv-8", user: "Manny", space: "Office Staff", timestamp: "2026-02-20T10:00:00Z", question: "Is a fire escape acceptable for egress in an MDL building?", response: "Fire escapes can be acceptable for egress in Multiple Dwelling Law (MDL) buildings, but with significant limitations:\n\n- **MDL §53** specifically addresses fire escape requirements for existing multiple dwellings\n- **RCNY §1-15** provides detailed standards for fire escape construction and maintenance\n- Fire escapes are generally grandfathered for existing buildings but cannot be used as required egress for new construction\n- For renovations, you may need to provide additional egress if the fire escape doesn't meet current standards\n\nKey: Check whether your building is Class A (new law) or Class B (old law) — this affects fire escape acceptability.", confidence: "medium", rag_sources: [{ file: "mdl_53_fire_escapes.md", relevance: 0.91 }, { file: "rcny_1_15_fire_escapes.md", relevance: 0.87 }, { file: "egress_requirements_guide.md", relevance: 0.79 }], card_type: "code_question" },
];

// --- Mock Feedback ---
export const mockFeedback: FeedbackEntry[] = [
  { id: "fb-1", type: "correction", user: "Chris Henry", timestamp: "2026-02-20T14:00:00Z", original_question: "What's the TR1 deadline for energy code?", text: "TR1 is not just for energy code — it covers all energy analysis. Also, the deadline changed with BB 2026-005.", status: "pending" },
  { id: "fb-2", type: "suggestion", user: "Justin", timestamp: "2026-02-19T10:30:00Z", original_question: "N/A", text: "Add a guide for filing temporary structures permits — we get a lot of these for construction trailers.", status: "pending" },
  { id: "fb-3", type: "tip", user: "Manny", timestamp: "2026-02-18T16:00:00Z", original_question: "N/A", text: "When filing elevator PAAs, always check if the original DOT approval is still valid — they expire after 2 years.", status: "applied" },
  { id: "fb-4", type: "correction", user: "Chris Henry", timestamp: "2026-02-15T09:00:00Z", original_question: "Can I use BIS for Alt-2 filings?", text: "BIS is being phased out — most Alt-2 filings should now go through DOB NOW. Only certain legacy job types still use BIS.", status: "applied" },
  { id: "fb-5", type: "suggestion", user: "Justin", timestamp: "2026-02-14T11:00:00Z", original_question: "N/A", text: "Create a decision tree for determining which code applies based on filing date and project type.", status: "pending" },
];

// --- Mock Analytics ---
export const mockAnalytics: AnalyticsSummary = {
  total_questions: 1247,
  avg_confidence: 78,
  kb_files: 87,
  low_confidence_count: 43,
  daily_counts: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0],
    count: Math.floor(Math.random() * 30) + 20,
  })),
  category_counts: [
    { category: "Processes", count: 520 },
    { category: "DOB Notices", count: 210 },
    { category: "Building Code", count: 180 },
    { category: "Zoning", count: 120 },
    { category: "MDL", count: 85 },
    { category: "Historical", count: 65 },
    { category: "HMC", count: 35 },
    { category: "RCNY", count: 20 },
    { category: "Other", count: 12 },
  ],
  confidence_distribution: [
    { level: "High", count: 780 },
    { level: "Medium", count: 424 },
    { level: "Low", count: 43 },
  ],
  top_questions: [
    { question: "What's the difference between Alt-1 and Alt-2?", count: 34 },
    { question: "How do I file an NB in DOB NOW?", count: 28 },
    { question: "Which code applies to my project?", count: 25 },
    { question: "Do I need professional certification?", count: 22 },
    { question: "What are the energy code requirements?", count: 20 },
    { question: "How do I file a PAA?", count: 18 },
    { question: "What's the fire alarm filing process?", count: 16 },
    { question: "How do I resolve a DOB violation?", count: 15 },
    { question: "What zoning district is this in?", count: 14 },
    { question: "Can I file this as Alt-2 instead of Alt-1?", count: 13 },
  ],
  corrections_count: 12,
  suggestions_count: 8,
};

// --- Beacon Spaces for Settings ---
export const mockBeaconSpaces = [
  { name: "Office Staff", members: 8, questions: 342, top_topics: ["Filings", "Code", "Violations"] },
  { name: "Project Alpha", members: 4, questions: 89, top_topics: ["NB Filing", "Energy Code"] },
  { name: "Field Team", members: 6, questions: 156, top_topics: ["Inspections", "Violations", "Safety"] },
  { name: "Billing Questions", members: 3, questions: 45, top_topics: ["Permits", "Fees"] },
];
