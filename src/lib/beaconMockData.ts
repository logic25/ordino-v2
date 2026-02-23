// ===== Beacon Mock Data & Types =====

// --- Types ---
export type KBCategory = "processes" | "dob_notices" | "building_code_2022" | "building_code_1968" | "building_code_general" | "zoning" | "mdl" | "hmc" | "historical" | "rcny" | "communication";
export type KBStatus = "active" | "needs_review";
export type BBStatus = "ACTIVE" | "SUPERSEDED" | "RESCINDED";
export type BBCategory = "Energy" | "Structural" | "Fire Protection" | "Professional Certification" | "Zoning" | "General" | "Mechanical" | "Elevator" | "Sustainability";
export type ContentStatus = "incoming" | "scored" | "draft" | "published" | "rejected";
export type ContentType = "blog" | "newsletter" | "internal";
export type ConfidenceLevel = "high" | "medium" | "low";
export type CardType = "general" | "property_lookup" | "filing_question" | "code_question";

export interface KnowledgeFile {
  id: string;
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

// --- Mock Knowledge Base Files ---
export const mockKnowledgeFiles: KnowledgeFile[] = [
  { id: "kb-1", title: "NB Filing Guide — DOB NOW", category: "processes", last_updated: "2026-02-10", chunk_count: 12, status: "active", tags: ["new-building", "dob-now", "filing"], has_verify_tags: false, content_preview: "Complete step-by-step guide for filing New Building applications through DOB NOW..." },
  { id: "kb-2", title: "Alt-1 Major Alteration Guide", category: "processes", last_updated: "2026-01-28", chunk_count: 8, status: "active", tags: ["alt-1", "alteration", "major"], has_verify_tags: false, content_preview: "Guide for filing Alteration Type 1 (major alteration) applications..." },
  { id: "kb-3", title: "Alt-2 Minor Alteration Guide", category: "processes", last_updated: "2026-01-15", chunk_count: 7, status: "active", tags: ["alt-2", "alteration", "minor"], has_verify_tags: false, content_preview: "Guide for filing Alteration Type 2 (minor alteration) applications..." },
  { id: "kb-4", title: "BB 2022-007: Code Applicability", category: "dob_notices", last_updated: "2025-12-20", chunk_count: 6, status: "active", tags: ["buildings-bulletin", "code-applicability"], has_verify_tags: false, content_preview: "Buildings Bulletin 2022-007 clarifying code applicability for projects..." },
  { id: "kb-5", title: "ZR Article I — General Provisions", category: "zoning", last_updated: "2025-11-10", chunk_count: 15, status: "active", tags: ["zoning", "article-1", "general"], has_verify_tags: false, content_preview: "Zoning Resolution Article I covering general provisions and definitions..." },
  { id: "kb-6", title: "Energy Code Compliance Guide", category: "processes", last_updated: "2026-02-01", chunk_count: 10, status: "needs_review", tags: ["energy-code", "nycecc", "compliance"], has_verify_tags: true, content_preview: "Guide for NYCECC compliance including [VERIFY] updated 2025 energy code thresholds..." },
  { id: "kb-7", title: "PA Place of Assembly Guide", category: "processes", last_updated: "2026-01-05", chunk_count: 7, status: "active", tags: ["place-of-assembly", "pa", "certificate"], has_verify_tags: false, content_preview: "Complete guide for Place of Assembly certificate applications..." },
  { id: "kb-8", title: "PAA Post Approval Amendment Guide", category: "processes", last_updated: "2026-01-20", chunk_count: 5, status: "active", tags: ["paa", "post-approval", "amendment"], has_verify_tags: false, content_preview: "Guide for filing Post Approval Amendments on approved applications..." },
  { id: "kb-9", title: "MDL Article 7-B SRO Compliance", category: "mdl", last_updated: "2025-10-15", chunk_count: 9, status: "active", tags: ["mdl", "sro", "article-7b", "multiple-dwelling"], has_verify_tags: false, content_preview: "Multiple Dwelling Law Article 7-B compliance guide for SRO buildings..." },
  { id: "kb-10", title: "Fire Alarm Approval Guide", category: "processes", last_updated: "2026-02-15", chunk_count: 6, status: "active", tags: ["fire-alarm", "fdny", "approval"], has_verify_tags: false, content_preview: "Guide for fire alarm system approvals and FDNY coordination..." },
  { id: "kb-11", title: "Demolition Filing Guide", category: "processes", last_updated: "2025-12-01", chunk_count: 8, status: "active", tags: ["demolition", "filing", "safety"], has_verify_tags: false, content_preview: "Complete demolition permit filing process including safety plans..." },
  { id: "kb-12", title: "Scaffold & Sidewalk Shed Guide", category: "processes", last_updated: "2025-11-20", chunk_count: 6, status: "active", tags: ["scaffold", "sidewalk-shed", "safety"], has_verify_tags: false, content_preview: "Filing and renewal procedures for scaffolding and sidewalk sheds..." },
  { id: "kb-13", title: "Elevator Filing Guide", category: "processes", last_updated: "2025-09-10", chunk_count: 7, status: "active", tags: ["elevator", "filing", "dot"], has_verify_tags: false, content_preview: "Guide for elevator installation and modification filings..." },
  { id: "kb-14", title: "Certificate of Occupancy Guide", category: "processes", last_updated: "2026-01-10", chunk_count: 9, status: "active", tags: ["co", "certificate-of-occupancy", "final"], has_verify_tags: false, content_preview: "Guide for obtaining Certificates of Occupancy and Temporary COs..." },
  { id: "kb-15", title: "Sprinkler Filing Guide", category: "processes", last_updated: "2025-08-15", chunk_count: 5, status: "active", tags: ["sprinkler", "fire-suppression", "filing"], has_verify_tags: false, content_preview: "Sprinkler system filing requirements and procedures..." },
  { id: "kb-16", title: "DOB Violations Guide", category: "processes", last_updated: "2026-02-05", chunk_count: 8, status: "active", tags: ["violations", "ecb", "oath", "penalties"], has_verify_tags: false, content_preview: "Guide for resolving DOB violations, ECB hearings, and penalty mitigation..." },
  { id: "kb-17", title: "Landmark Filing Guide", category: "processes", last_updated: "2025-07-20", chunk_count: 6, status: "active", tags: ["landmark", "lpc", "historic"], has_verify_tags: false, content_preview: "Filing procedures for landmarks and historic districts..." },
  { id: "kb-18", title: "BB 2026-005: NYCECC 2025 Energy Code", category: "dob_notices", last_updated: "2026-01-15", chunk_count: 5, status: "active", tags: ["buildings-bulletin", "energy-code", "nycecc"], has_verify_tags: false, content_preview: "Buildings Bulletin 2026-005 on NYCECC applicability for 2025 Energy Code..." },
  { id: "kb-19", title: "BB 2025-005: Professional Certification", category: "dob_notices", last_updated: "2025-06-01", chunk_count: 4, status: "active", tags: ["buildings-bulletin", "professional-cert"], has_verify_tags: false, content_preview: "Updated professional certification requirements under BB 2025-005..." },
  { id: "kb-20", title: "Pre-1961 Building Code Guide", category: "historical", last_updated: "2025-05-10", chunk_count: 11, status: "active", tags: ["pre-1961", "historical", "code-evolution"], has_verify_tags: false, content_preview: "Guide to navigating pre-1961 building code requirements..." },
  { id: "kb-21", title: "1968 Building Code Reference", category: "building_code_1968", last_updated: "2025-04-01", chunk_count: 14, status: "active", tags: ["1968-code", "legacy", "reference"], has_verify_tags: false, content_preview: "Reference guide for the 1968 NYC Building Code provisions..." },
  { id: "kb-22", title: "2022 Construction Code — Structural", category: "building_code_2022", last_updated: "2025-12-15", chunk_count: 12, status: "active", tags: ["2022-code", "structural", "current"], has_verify_tags: false, content_preview: "Structural provisions of the 2022 NYC Construction Code..." },
  { id: "kb-23", title: "2022 Construction Code — Fire Protection", category: "building_code_2022", last_updated: "2025-12-15", chunk_count: 10, status: "active", tags: ["2022-code", "fire-protection", "current"], has_verify_tags: false, content_preview: "Fire protection provisions under the 2022 NYC Construction Code..." },
  { id: "kb-24", title: "2022 Construction Code — Mechanical", category: "building_code_2022", last_updated: "2025-12-15", chunk_count: 8, status: "active", tags: ["2022-code", "mechanical", "current"], has_verify_tags: false, content_preview: "Mechanical systems provisions of the 2022 NYC Construction Code..." },
  { id: "kb-25", title: "Code Comparison: 1968 vs 2022", category: "building_code_general", last_updated: "2025-10-01", chunk_count: 9, status: "active", tags: ["code-comparison", "1968", "2022"], has_verify_tags: false, content_preview: "Side-by-side comparison of key provisions between 1968 and 2022 codes..." },
  { id: "kb-26", title: "Code Applicability Guide", category: "building_code_general", last_updated: "2025-09-15", chunk_count: 7, status: "active", tags: ["code-applicability", "transition", "filing"], has_verify_tags: false, content_preview: "Guide for determining which building code applies to your project..." },
  { id: "kb-27", title: "ZR Use Groups & Classifications", category: "zoning", last_updated: "2025-08-01", chunk_count: 10, status: "active", tags: ["zoning", "use-groups", "classifications"], has_verify_tags: false, content_preview: "Zoning Resolution use group classifications and permitted uses..." },
  { id: "kb-28", title: "ZR Bulk & Setback Requirements", category: "zoning", last_updated: "2025-08-01", chunk_count: 8, status: "active", tags: ["zoning", "bulk", "setback", "far"], has_verify_tags: false, content_preview: "Zoning bulk regulations including FAR, lot coverage, and setbacks..." },
  { id: "kb-29", title: "MDL Article 1 — General Definitions", category: "mdl", last_updated: "2025-06-15", chunk_count: 6, status: "active", tags: ["mdl", "definitions", "article-1"], has_verify_tags: false, content_preview: "Multiple Dwelling Law Article 1 definitions and classifications..." },
  { id: "kb-30", title: "MDL Article 2 — Requirements", category: "mdl", last_updated: "2025-06-15", chunk_count: 7, status: "active", tags: ["mdl", "requirements", "article-2"], has_verify_tags: false, content_preview: "MDL Article 2 requirements for multiple dwellings..." },
  { id: "kb-31", title: "MDL Article 4 — Fire Protection", category: "mdl", last_updated: "2025-06-15", chunk_count: 8, status: "active", tags: ["mdl", "fire-protection", "article-4"], has_verify_tags: false, content_preview: "MDL Article 4 fire protection requirements for multiple dwellings..." },
  { id: "kb-32", title: "MDL Article 5 — Light & Ventilation", category: "mdl", last_updated: "2025-06-15", chunk_count: 5, status: "active", tags: ["mdl", "light", "ventilation", "article-5"], has_verify_tags: false, content_preview: "MDL Article 5 light and ventilation requirements..." },
  { id: "kb-33", title: "MDL Article 6 — Sanitation", category: "mdl", last_updated: "2025-06-15", chunk_count: 4, status: "active", tags: ["mdl", "sanitation", "article-6"], has_verify_tags: false, content_preview: "MDL Article 6 sanitary provisions for multiple dwellings..." },
  { id: "kb-34", title: "HMC Housing Maintenance Code Guide", category: "hmc", last_updated: "2025-05-01", chunk_count: 10, status: "active", tags: ["hmc", "housing-maintenance", "compliance"], has_verify_tags: false, content_preview: "Housing Maintenance Code compliance guide for building owners..." },
  { id: "kb-35", title: "RCNY Rules Reference", category: "rcny", last_updated: "2025-04-15", chunk_count: 8, status: "active", tags: ["rcny", "rules", "city-of-new-york"], has_verify_tags: false, content_preview: "Rules of the City of New York relevant to construction and building..." },
  { id: "kb-36", title: "Response Templates & Communication", category: "communication", last_updated: "2026-01-30", chunk_count: 4, status: "active", tags: ["communication", "templates", "team"], has_verify_tags: false, content_preview: "Standard response templates for client and agency communication..." },
  { id: "kb-37", title: "Historical Code Evolution 1900-1968", category: "historical", last_updated: "2025-03-01", chunk_count: 9, status: "active", tags: ["historical", "code-evolution", "timeline"], has_verify_tags: false, content_preview: "Timeline of NYC building code evolution from 1900 to 1968..." },
  { id: "kb-38", title: "Prior Code Applicability", category: "historical", last_updated: "2025-03-15", chunk_count: 7, status: "active", tags: ["prior-code", "applicability", "grandfathering"], has_verify_tags: false, content_preview: "Guide to prior code applicability and grandfathering provisions..." },
  { id: "kb-39", title: "Plumbing Filing Guide", category: "processes", last_updated: "2025-11-05", chunk_count: 6, status: "active", tags: ["plumbing", "filing", "laa"], has_verify_tags: false, content_preview: "Plumbing permit filing procedures and LAA requirements..." },
  { id: "kb-40", title: "Boiler Installation Guide", category: "processes", last_updated: "2025-10-20", chunk_count: 5, status: "needs_review", tags: ["boiler", "installation", "filing"], has_verify_tags: true, content_preview: "Boiler installation filing guide [VERIFY] updated inspection requirements..." },
  // Additional files to reach category counts
  ...Array.from({ length: 47 }, (_, i) => ({
    id: `kb-${41 + i}`,
    title: `${["DOB NOW", "BIS", "Permit", "Filing", "Inspection", "Approval", "Compliance", "Review"][i % 8]} Guide — ${["Mechanical", "Electrical", "Structural", "Fire Protection", "Plumbing", "Elevator", "Facade", "Foundation"][i % 8]} ${i + 1}`,
    category: (["processes", "processes", "dob_notices", "historical", "processes", "dob_notices", "processes", "processes"] as KBCategory[])[i % 8],
    last_updated: `2025-${String(((i % 12) + 1)).padStart(2, "0")}-${String(((i % 28) + 1)).padStart(2, "0")}`,
    chunk_count: 4 + (i % 10),
    status: (i % 15 === 0 ? "needs_review" : "active") as KBStatus,
    tags: ["filing", "guide"],
    has_verify_tags: i % 15 === 0,
    content_preview: `Detailed guide for ${["mechanical", "electrical", "structural", "fire protection", "plumbing", "elevator", "facade", "foundation"][i % 8]} filings...`,
  })),
];

// --- Mock Buildings Bulletins ---
export const mockBulletins: BuildingsBulletin[] = [
  { id: "bb-1", bb_number: "2026-005", title: "NYCECC Applicability for 2025 Energy Code", issue_date: "2026-01-15", status: "ACTIVE", supersedes: ["2020-002"], superseded_by: null, category: "Energy", applies_to: "2022 Code", key_takeaway: "Establishes energy code compliance path for 2025 NYCECC — all new filings after 3/1/2026 must comply.", in_knowledge_base: true, reference_count: 45 },
  { id: "bb-2", bb_number: "2025-005", title: "Professional Certification Program Updates", issue_date: "2025-06-01", status: "ACTIVE", supersedes: ["2016-010"], superseded_by: null, category: "Professional Certification", applies_to: "All", key_takeaway: "Updated requirements for professionally certified applications including new audit procedures.", in_knowledge_base: true, reference_count: 38 },
  { id: "bb-3", bb_number: "2025-001", title: "Boiler Inspection Requirements Update", issue_date: "2025-01-15", status: "ACTIVE", supersedes: ["2022-006"], superseded_by: null, category: "Mechanical", applies_to: "Both", key_takeaway: "Updated boiler inspection intervals and reporting requirements for all buildings.", in_knowledge_base: true, reference_count: 22 },
  { id: "bb-4", bb_number: "2024-001", title: "Fire Alarm Requirements Under 2022 Code", issue_date: "2024-03-01", status: "ACTIVE", supersedes: ["2015-025"], superseded_by: null, category: "Fire Protection", applies_to: "2022 Code", key_takeaway: "Fire alarm system requirements for buildings filed under the 2022 Construction Code.", in_knowledge_base: true, reference_count: 35 },
  { id: "bb-5", bb_number: "2023-002", title: "Smoke Control System Wiring Standards", issue_date: "2023-04-15", status: "ACTIVE", supersedes: ["2017-011"], superseded_by: null, category: "Fire Protection", applies_to: "Both", key_takeaway: "Updated wiring standards for smoke control systems in high-rise buildings.", in_knowledge_base: true, reference_count: 18 },
  { id: "bb-6", bb_number: "2022-016", title: "Bulk Rescission of Outdated Bulletins", issue_date: "2022-12-01", status: "ACTIVE", supersedes: ["2010-001", "2010-005", "2011-003", "2012-007", "2013-002", "2014-008", "2014-012", "2015-003"], superseded_by: null, category: "General", applies_to: "All", key_takeaway: "Rescinded 8 outdated bulletins no longer applicable under current codes.", in_knowledge_base: true, reference_count: 12 },
  { id: "bb-7", bb_number: "2025-006", title: "Accessory Dwelling Units (ADU) Filing Procedures", issue_date: "2025-08-01", status: "RESCINDED", supersedes: [], superseded_by: null, category: "Zoning", applies_to: "All", key_takeaway: "RESCINDED — ADU filing procedures withdrawn pending new legislation.", in_knowledge_base: false, reference_count: 5 },
  { id: "bb-8", bb_number: "2022-007", title: "Code Applicability for Pending Applications", issue_date: "2022-06-15", status: "ACTIVE", supersedes: [], superseded_by: null, category: "General", applies_to: "Both", key_takeaway: "Clarifies which code applies to applications filed before and after 2022 code effective date.", in_knowledge_base: true, reference_count: 52 },
  { id: "bb-9", bb_number: "2020-002", title: "Energy Code Compliance Under NYCECC 2020", issue_date: "2020-03-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2026-005", category: "Energy", applies_to: "2014 Code", key_takeaway: "Superseded by BB 2026-005 — was the primary energy code reference for 2020 NYCECC.", in_knowledge_base: true, reference_count: 30 },
  { id: "bb-10", bb_number: "2016-010", title: "Professional Certification Procedures", issue_date: "2016-05-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2025-005", category: "Professional Certification", applies_to: "All", key_takeaway: "Superseded by BB 2025-005 — original professional cert program procedures.", in_knowledge_base: false, reference_count: 15 },
  { id: "bb-11", bb_number: "2022-006", title: "Boiler Inspection Intervals", issue_date: "2022-04-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2025-001", category: "Mechanical", applies_to: "Both", key_takeaway: "Superseded by BB 2025-001 — original boiler inspection interval guidance.", in_knowledge_base: false, reference_count: 8 },
  { id: "bb-12", bb_number: "2015-025", title: "Fire Alarm Requirements — 2014 Code", issue_date: "2015-09-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2024-001", category: "Fire Protection", applies_to: "2014 Code", key_takeaway: "Superseded by BB 2024-001 — fire alarm requirements under the 2014 code.", in_knowledge_base: false, reference_count: 10 },
  { id: "bb-13", bb_number: "2017-011", title: "Smoke Control Wiring — Original", issue_date: "2017-07-01", status: "SUPERSEDED", supersedes: [], superseded_by: "2023-002", category: "Fire Protection", applies_to: "2014 Code", key_takeaway: "Superseded by BB 2023-002 — original smoke control wiring standards.", in_knowledge_base: false, reference_count: 6 },
  { id: "bb-14", bb_number: "2022-010", title: "Elevator Modernization Filing Requirements", issue_date: "2022-08-15", status: "ACTIVE", supersedes: [], superseded_by: null, category: "Elevator", applies_to: "Both", key_takeaway: "Filing requirements for elevator modernization projects.", in_knowledge_base: true, reference_count: 28 },
  { id: "bb-15", bb_number: "2023-005", title: "Sustainability Requirements for New Buildings", issue_date: "2023-09-01", status: "ACTIVE", supersedes: [], superseded_by: null, category: "Sustainability", applies_to: "2022 Code", key_takeaway: "LL97 compliance and sustainability requirements for new construction.", in_knowledge_base: true, reference_count: 32 },
  { id: "bb-16", bb_number: "2024-003", title: "Structural Peer Review Requirements", issue_date: "2024-06-01", status: "ACTIVE", supersedes: [], superseded_by: null, category: "Structural", applies_to: "2022 Code", key_takeaway: "New peer review requirements for structural designs over certain thresholds.", in_knowledge_base: true, reference_count: 20 },
];

// --- Mock Content Candidates ---
export const mockContentCandidates: ContentCandidate[] = [
  { id: "cc-1", title: "New BB 2026-005: What the 2025 Energy Code Means for Your Filings", source: "DOB Newsletter — Jan 2026", relevance_score: 92, content_type: "blog", status: "draft", draft_content: "# What the 2025 Energy Code Means for Your Filings\n\nThe DOB has issued Buildings Bulletin 2026-005, establishing new energy code compliance paths under the 2025 NYCECC...\n\n## Key Changes\n- All new filings after March 1, 2026 must comply with updated energy thresholds\n- Existing applications in progress may continue under prior energy code\n- New prescriptive path options for small residential projects\n\n## What Expediters Need to Know\n1. Review all pending energy code submissions for compliance\n2. Update TR1 forms to reference 2025 NYCECC\n3. Coordinate with energy consultants on updated calculations...", related_questions_count: 15, created_at: "2026-02-20" },
  { id: "cc-2", title: "Professional Certification Changes Under BB 2025-005", source: "DOB Newsletter — Jun 2025", relevance_score: 87, content_type: "newsletter", status: "scored", draft_content: "", related_questions_count: 8, created_at: "2026-02-18" },
  { id: "cc-3", title: "City of Yes Zoning: What Expediters Need to Know", source: "DOB Newsletter — Nov 2025", relevance_score: 78, content_type: "blog", status: "published", draft_content: "# City of Yes: What Expediters Need to Know\n\nThe City of Yes zoning text amendments represent the most significant change to NYC's zoning resolution in decades...", related_questions_count: 22, created_at: "2026-01-15" },
  { id: "cc-4", title: "Understanding the 2022 Code Transition: What Still Applies", source: "Team question analysis", relevance_score: 85, content_type: "blog", status: "draft", draft_content: "# 2022 Code Transition Guide\n\nWith the transition to the 2022 NYC Construction Code, many teams have questions about which code applies to their projects...", related_questions_count: 18, created_at: "2026-02-15" },
  { id: "cc-5", title: "Fire Alarm Updates: BB 2024-001 Simplified", source: "DOB Newsletter — Mar 2024", relevance_score: 81, content_type: "internal", status: "published", draft_content: "## Fire Alarm Filing Changes\n\nBB 2024-001 updates fire alarm requirements for 2022 code filings...", related_questions_count: 12, created_at: "2024-04-01" },
  { id: "cc-6", title: "Sidewalk Shed Renewals: A Complete Guide", source: "Team question analysis", relevance_score: 72, content_type: "blog", status: "incoming", draft_content: "", related_questions_count: 9, created_at: "2026-02-22" },
  { id: "cc-7", title: "DOB NOW vs BIS: When to Use Which System", source: "Team question analysis", relevance_score: 90, content_type: "newsletter", status: "draft", draft_content: "# DOB NOW vs BIS: The Definitive Guide\n\nOne of the most common questions our team gets is which DOB system to use for different filing types...", related_questions_count: 25, created_at: "2026-02-19" },
];

// --- Mock Conversations ---
export const mockConversations: BeaconConversation[] = [
  { id: "conv-1", user: "Chris Henry", space: "DM", timestamp: "2026-02-23T09:15:00Z", question: "What's the difference between Alt-1 and Alt-2?", response: "**Alt-1 (Alteration Type 1)** involves a change of use, occupancy, or exit modifications. It requires full compliance with the current building code for the affected areas.\n\n**Alt-2 (Alteration Type 2)** covers work that doesn't change the use, occupancy, or exit. It includes things like plumbing, mechanical, and interior renovation work.\n\nKey differences:\n- Alt-1 requires DOB NOW filing with full plans\n- Alt-2 can often use a simplified filing process\n- Alt-1 triggers code compliance for the entire affected area\n- Alt-2 only needs to comply for the specific work being done", confidence: "high", rag_sources: [{ file: "Alt-1 Major Alteration Guide", relevance: 0.94 }, { file: "Alt-2 Minor Alteration Guide", relevance: 0.91 }, { file: "Code Applicability Guide", relevance: 0.82 }], card_type: "general" },
  { id: "conv-2", user: "Justin", space: "Office Staff", timestamp: "2026-02-23T10:30:00Z", question: "Do I need a TR8 for this energy code filing?", response: "A TR8 (Energy Analysis) is required for most energy code filings, but it depends on the project type:\n\n- **Required**: New Buildings, Alt-1 with full floor renovations\n- **May not be required**: Alt-2 with limited scope, equipment replacements only\n\nUnder the new BB 2026-005 (effective 3/1/2026), the TR8 requirements are being updated. Check if your filing date is before or after that cutoff.", confidence: "medium", rag_sources: [{ file: "Energy Code Compliance Guide", relevance: 0.78 }], card_type: "code_question" },
  { id: "conv-3", user: "Manny", space: "DM", timestamp: "2026-02-22T14:45:00Z", question: "Can I file a PAA on a professionally certified job?", response: "Yes, you can file a Post Approval Amendment (PAA) on a professionally certified job. However, there are important considerations:\n\n1. The PAA itself can also be professionally certified\n2. The original PE/RA who certified the job should ideally file the PAA\n3. If a different PE/RA files the PAA, they take responsibility for the entire scope\n4. Under BB 2025-005, audit procedures for PAAs on certified jobs have been updated", confidence: "high", rag_sources: [{ file: "PAA Post Approval Amendment Guide", relevance: 0.92 }, { file: "BB 2025-005: Professional Certification", relevance: 0.85 }], card_type: "filing_question" },
  { id: "conv-4", user: "Chris Henry", space: "Office Staff", timestamp: "2026-02-22T11:00:00Z", question: "What's the sidewalk shed renewal process?", response: "I don't have detailed information about the sidewalk shed renewal process in my current knowledge base. I'd recommend:\n\n1. Checking DOB NOW for renewal application options\n2. Contacting DOB directly for current renewal procedures\n3. Checking if any recent Buildings Bulletins address this topic\n\n*Note: This is an area where my knowledge may be incomplete. Please verify with DOB directly.*", confidence: "low", rag_sources: [], card_type: "general" },
  { id: "conv-5", user: "Justin", space: "DM", timestamp: "2026-02-21T16:20:00Z", question: "Look up 927 Broadway", response: "**927 Broadway, Manhattan**\n\n| Field | Value |\n|-------|-------|\n| BIN | 1015432 |\n| Block/Lot | 00571/0023 |\n| Zoning | C6-4A |\n| Building Class | O4 (Office) |\n| Stories | 12 |\n| Year Built | 1903 |\n| Open Violations | 3 |\n| Last Permit | NB-2024-1234 (Active) |\n\n*Data from NYC Open Data / BIS*", confidence: "high", rag_sources: [], card_type: "property_lookup" },
  { id: "conv-6", user: "Manny", space: "Project Alpha", timestamp: "2026-02-21T09:00:00Z", question: "How do I file an NB in DOB NOW?", response: "Here's the step-by-step process for filing a New Building (NB) in DOB NOW:\n\n1. ☐ Log into DOB NOW at www.nyc.gov/dobnow\n2. ☐ Select 'Jobs' → 'File New Job'\n3. ☐ Choose 'New Building' as job type\n4. ☐ Enter property address and verify BIN/Block/Lot\n5. ☐ Complete General Information section\n6. ☐ Upload required documents (plans, zoning analysis, structural)\n7. ☐ Enter all applicable Technical Reports (TR1-TR8)\n8. ☐ Assign registered design professional\n9. ☐ Pay filing fees\n10. ☐ Submit for DOB review\n\n**Required Documents**: Architectural plans, structural plans, zoning analysis, energy code compliance (TR1), and applicable special inspections.", confidence: "high", rag_sources: [{ file: "NB Filing Guide — DOB NOW", relevance: 0.96 }], card_type: "filing_question" },
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

// --- Mock Chat Spaces for Beacon ---
export const mockBeaconSpaces = [
  { name: "Office Staff", members: 8, questions: 342, top_topics: ["Filings", "Code", "Violations"] },
  { name: "Project Alpha", members: 4, questions: 89, top_topics: ["NB Filing", "Energy Code"] },
  { name: "Field Team", members: 6, questions: 156, top_topics: ["Inspections", "Violations", "Safety"] },
  { name: "Billing Questions", members: 3, questions: 45, top_topics: ["Permits", "Fees"] },
];
