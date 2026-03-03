// B-SCAN Required Items — typical DOB checklist items per phase
// Users track: who we need it from, notes, when we asked, when we got it

export interface RequiredItem {
  id: string;
  name: string;
  phase: "APP" | "PER" | "SGN";        // Application / Permit / Sign-off
  receivedFrom: string;                 // Who we're getting it from
  notes: string;
  dateRequested: string | null;         // When we asked / were told
  dateReceived: string | null;          // When we actually got it
  waived: boolean;
}

export const PHASE_LABELS: Record<string, string> = {
  APP: "Application",
  PER: "Permit",
  SGN: "Sign-Off",
};

export const PHASE_COLORS: Record<string, string> = {
  APP: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  PER: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  SGN: "bg-green-500/10 text-green-700 border-green-500/20",
};

// Default B-SCAN items — users can add/remove per application
export const DEFAULT_REQUIRED_ITEMS: Omit<RequiredItem, "id" | "receivedFrom" | "notes" | "dateRequested" | "dateReceived" | "waived">[] = [
  // --- Application phase ---
  { name: "Sewer Connection: DEP SD1 & SD2", phase: "APP" },
  { name: "BPP: Filing Required", phase: "APP" },
  { name: "Street Tree Checklist", phase: "APP" },
  { name: "Soil Report", phase: "APP" },
  { name: "DOB — Zoning Diagram (ZD1)", phase: "APP" },
  { name: "Verify DOB Plan Naming Standard Is Met", phase: "APP" },
  { name: "1st Zoning Review Complete", phase: "APP" },
  { name: "2nd Zoning Review Complete", phase: "APP" },
  { name: "TR8: Energy Code Progress Insps Technical Report", phase: "APP" },
  { name: "NYCECC Analysis", phase: "APP" },
  { name: "Energy Code 1st Review Complete", phase: "APP" },
  { name: "Energy Code Compliance Fee", phase: "APP" },
  { name: "Address: New House Number Approved", phase: "APP" },
  { name: "Tax Lot: Tentative Lot Number Issued", phase: "APP" },
  { name: "Site Connection: DEP", phase: "APP" },
  { name: "Site Survey: Initial", phase: "APP" },
  { name: "Zoning Exhibit I: Certification", phase: "APP" },
  { name: "Zoning Exhibit II: Desc. & Ownership Stmt", phase: "APP" },
  { name: "All Objections Response", phase: "APP" },
  { name: "Subsurface / Soils Investigation (Borings/Test Pits)", phase: "APP" },

  // --- Permit phase ---
  { name: "Street Trees: Receipt of Street Trees Site Plan", phase: "PER" },
  { name: "Demolition (DM) Job Signoff", phase: "PER" },
  { name: "Insurance: Workers' Compensation", phase: "PER" },
  { name: "Insurance: Liability", phase: "PER" },
  { name: "Insurance: Disability", phase: "PER" },
  { name: "TR3: Concrete Design Mix Technical Report", phase: "PER" },
  { name: "Project-Specific GL Insurance", phase: "PER" },
  { name: "TR2: Concrete Field Testing Technical Report", phase: "PER" },
  { name: "Energy Code Compliance Inspections", phase: "PER" },
  { name: "Insulation Placement & R Values", phase: "PER" },
  { name: "Fenestration U-Factor & Product Rating", phase: "PER" },
  { name: "Fenestration Air Leakage", phase: "PER" },
  { name: "Fenestration Areas", phase: "PER" },
  { name: "Air Sealing and Insulation — Visual", phase: "PER" },
  { name: "Exit Signs", phase: "PER" },
  { name: "Interior Lighting Power", phase: "PER" },
  { name: "Exterior Lighting Power", phase: "PER" },
  { name: "Lighting Controls", phase: "PER" },
  { name: "Excavation or Demolition: 5-Day Notice", phase: "PER" },
  { name: "Structural Steel — High Strength Bolting", phase: "PER" },
  { name: "Concrete — Cast-in-Place", phase: "PER" },
  { name: "Masonry", phase: "PER" },
  { name: "Subgrade Insp / Soils — Site Prep", phase: "PER" },
  { name: "Mechanical Systems", phase: "PER" },
  { name: "Sprinkler Systems", phase: "PER" },
  { name: "Fire-Resistant Penetrations and Joints (Firestop)", phase: "PER" },
  { name: "Footing and Foundation Inspection", phase: "PER" },
  { name: "Fire-Resistive Rated Construction", phase: "PER" },

  // --- Sign-off phase ---
  { name: "Certificate of Occupancy", phase: "SGN" },
  { name: "Site Survey: Final", phase: "SGN" },
  { name: "BPP: Final Signoff", phase: "SGN" },
  { name: "Street Tree Signoff", phase: "SGN" },
  { name: "As-Built Energy Analysis (EN2)", phase: "SGN" },
  { name: "Final Plumbing Signoff", phase: "SGN" },
  { name: "Final Elevator Signoff", phase: "SGN" },
  { name: "Final Electrical Signoff", phase: "SGN" },
  { name: "Final Construction Signoff", phase: "SGN" },
  { name: "Verify Tax Lot", phase: "SGN" },
  { name: "CO Obj: Verify Address — Topo Stamp", phase: "SGN" },
  { name: "Violations Search", phase: "SGN" },
  { name: "Open Applications Search", phase: "SGN" },
  { name: "Folder Review", phase: "SGN" },
  { name: "RPZ/DDCV Test Report: GEN215B", phase: "SGN" },
  { name: "Sprinkler (SP) Signoff", phase: "SGN" },
  { name: "Elevator Job Signoff", phase: "SGN" },
  { name: "Mechanical (MH) Signoff", phase: "SGN" },
  { name: "Equipment Use Permits", phase: "SGN" },
  { name: "Plumbing (PL) Signoff", phase: "SGN" },
  { name: "Construction (OT) Signoff", phase: "SGN" },
  { name: "Sprinkler Insp Report: FP-85", phase: "SGN" },
  { name: "House Connection Signoff", phase: "SGN" },
];

/** Generate a fresh set of blank required items from the defaults */
export function createDefaultRequiredItems(): RequiredItem[] {
  return DEFAULT_REQUIRED_ITEMS.map((item, i) => ({
    ...item,
    id: `req-${i}`,
    receivedFrom: "",
    notes: "",
    dateRequested: null,
    dateReceived: null,
    waived: false,
  }));
}
