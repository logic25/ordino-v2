/**
 * Deterministic anti-fabrication backstop for objection response drafts.
 *
 * The model is NOT trusted to police itself. Any claim that something was
 * verified / confirmed / dimensioned / provided / shown / complies is rewritten
 * into an inline `[VERIFY: ...]` marker unless a drawing sheet is pinned to the
 * objection to back it up.
 *
 * Pure and side-effect free so the phrase list can be tuned and unit-tested.
 */

export interface VerifyMarker {
  /** The original phrase that triggered the flag. */
  phrase: string;
  /** Why it was flagged, shown to the user. */
  reason: string;
}

export interface VerifyScanResult {
  /** The text with unsupported claims rewritten as `[VERIFY: ...]`. */
  text: string;
  /** One entry per rewritten claim (high-confidence compliance assertions). */
  markers: VerifyMarker[];
  /**
   * Soft flags: weak words like "provided" / "shown" that are usually harmless
   * ("the applicant provided a response"). Surfaced for review, never rewritten
   * and never gating — so the scanner doesn't cry wolf.
   */
  advisories: VerifyMarker[];
}

/** Evidence context that turns a weak verb into a real drawing claim. */
const DRAWING_CONTEXT = /\b(?:drawing|drawings|sheet|plan|plans|dwg|site plan|elevation|section)\b/i;

/**
 * High confidence: real compliance assertions. These are always rewritten into
 * `[VERIFY: ...]` unless they cite a pinned sheet.
 */
const CLAIM_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\b(?:has been|have been|was|were|is|are)\s+(?:hereby\s+)?verified\b[^.;]*/gi, reason: "asserts something was verified" },
  { re: /\b(?:has been|have been|was|were|is|are)\s+(?:hereby\s+)?confirmed\b[^.;]*/gi, reason: "asserts something was confirmed" },
  { re: /\bwe\s+(?:have\s+)?(?:verified|confirmed)\b[^.;]*/gi, reason: "asserts we verified something" },
  { re: /\b(?:is|are|has been|have been|was|were)\s+dimensioned\b[^.;]*/gi, reason: "asserts a dimension is shown on a drawing" },
  { re: /\b(?:complies|comply|complied|is compliant|are compliant|is in compliance|are in compliance)\b[^.;]*/gi, reason: "asserts a compliance conclusion" },
  { re: /\b(?:meets|meet|satisfies|satisfy)\s+(?:the\s+)?(?:requirement|requirements|minimum|criteria|standard|standards)\b[^.;]*/gi, reason: "asserts a requirement is met" },
  { re: /\bas\s+(?:shown|dimensioned|indicated)\s+on\s+(?:the\s+)?(?:sheet|drawing|dwg\.?|plan)[^.;,]*/gi, reason: "cites a drawing as evidence" },
];

/**
 * Low confidence: bare "provided" / "shown" / "indicated" / "depicted" / "noted".
 * Only escalated to a hard marker when the sentence fragment also references a
 * drawing, sheet or plan — otherwise it's an advisory only.
 */
const WEAK_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\b(?:is|are|has been|have been|was|were)\s+(?:clearly\s+|properly\s+)?(?:shown|indicated|depicted|noted|reflected)\b[^.;]*/gi, reason: "says something is shown/indicated — confirm the source" },
  { re: /\b(?:is|are|has been|have been|was|were)\s+(?:fully\s+)?provided\b[^.;]*/gi, reason: "says something was provided — confirm it actually was" },
];


/** Sheet references like "sheet Z-1", "on A-101", "drawing G-002". */
const SHEET_PATTERN = /\b(?:sheet|drawing|dwg\.?|plan)\s+([A-Z]{1,3}[- ]?\d{1,3}(?:\.\d+)?)\b/gi;

/** Normalise a sheet id for comparison: "Z - 1" / "z-1" -> "Z1". */
export function normalizeSheet(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

/** Non-overlapping match collection, earliest and longest first. */
function collectMatches(text: string, patterns: { re: RegExp; reason: string }[]) {
  const found: { start: number; end: number; phrase: string; reason: string }[] = [];
  for (const { re, reason } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const phrase = m[0].trim();
      if (!phrase) continue;
      found.push({ start: m.index, end: m.index + m[0].length, phrase, reason });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: typeof found = [];
  let cursor = -1;
  for (const f of found) {
    if (f.start >= cursor) {
      kept.push(f);
      cursor = f.end;
    }
  }
  return kept;
}

export const VERIFY_MARKER_RE = /\[VERIFY:[^\]]*\]/g;

/** True when the text still contains an unresolved `[VERIFY: ...]` marker. */
export function hasVerifyMarkers(text: string | null | undefined): boolean {
  if (!text) return false;
  VERIFY_MARKER_RE.lastIndex = 0;
  return VERIFY_MARKER_RE.test(text);
}

/** Count unresolved markers in a body of text. */
export function countVerifyMarkers(text: string | null | undefined): number {
  if (!text) return 0;
  return text.match(VERIFY_MARKER_RE)?.length ?? 0;
}

/**
 * Scan a draft and flag unsupported claims.
 *
 * @param text          the draft text (AI-generated, typed, or pasted)
 * @param pinnedSheets  sheet numbers pinned to this objection (e.g. ["Z-1"]).
 *                      When empty, EVERY claim is flagged — that is correct,
 *                      not a limitation.
 */
export function scanForUnsupportedClaims(
  text: string,
  pinnedSheets: string[] = []
): VerifyScanResult {
  if (!text) return { text: "", markers: [], advisories: [] };

  const pinned = new Set(pinnedSheets.filter(Boolean).map(normalizeSheet));
  const hasPinned = pinned.size > 0;
  const markers: VerifyMarker[] = [];
  const advisories: VerifyMarker[] = [];

  // Don't re-scan text already inside an existing marker.
  const protectedRanges: [number, number][] = [];
  VERIFY_MARKER_RE.lastIndex = 0;
  let pm: RegExpExecArray | null;
  while ((pm = VERIFY_MARKER_RE.exec(text)) !== null) {
    protectedRanges.push([pm.index, pm.index + pm[0].length]);
  }
  const isProtected = (start: number, end: number) =>
    protectedRanges.some(([s, e]) => start < e && end > s);

  const strong = collectMatches(text, CLAIM_PATTERNS).filter((m) => !isProtected(m.start, m.end));
  const weakAll = collectMatches(text, WEAK_PATTERNS).filter(
    (m) => !isProtected(m.start, m.end) && !strong.some((s) => m.start < s.end && m.end > s.start)
  );
  // A weak verb only becomes a hard claim when it points at a drawing.
  const weakStrong = weakAll.filter((m) => DRAWING_CONTEXT.test(m.phrase));
  for (const w of weakAll) {
    if (!DRAWING_CONTEXT.test(w.phrase)) advisories.push({ phrase: w.phrase, reason: w.reason });
  }

  const candidates = [...strong, ...weakStrong].sort((a, b) => a.start - b.start);

  const flagged = candidates.filter((m) => {
    if (!hasPinned) return true;
    // A sheet IS pinned — allow the claim only when it cites a pinned sheet.
    SHEET_PATTERN.lastIndex = 0;
    const cited: string[] = [];
    let s: RegExpExecArray | null;
    while ((s = SHEET_PATTERN.exec(m.phrase)) !== null) cited.push(normalizeSheet(s[1]));
    if (cited.length === 0) return true; // claim with no sheet cited is still unbacked
    return !cited.every((c) => pinned.has(c));
  });

  if (flagged.length === 0) return { text, markers: [], advisories };

  let out = "";
  let last = 0;
  for (const f of flagged) {
    out += text.slice(last, f.start);
    out += `[VERIFY: ${f.phrase}]`;
    last = f.end;
    markers.push({ phrase: f.phrase, reason: f.reason });
  }
  out += text.slice(last);

  return { text: out, markers, advisories };
}
