import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  JURISDICTIONS,
  getJurisdictionTag,
  isJurisdictionKey,
  resolveJurisdictionTag,
  DEFAULT_JURISDICTION_KEY,
} from "@/lib/jurisdictions";

// ── Mock supabase for the askBeacon boundary test ──
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

// Imported after the mock is registered.
import { askBeacon } from "@/services/beaconApi";

// The Beacon retrieval filter is an EXACT match ($eq) against these tag strings. If any of
// these assertions drift, Ordino silently sends a wrong/invalid tag and Beacon returns zero
// KB context. This suite is the runtime guard against that exact-string bug.
describe("jurisdictions registry", () => {
  it("maps keys to the EXACT corpus tag strings", () => {
    expect(getJurisdictionTag("NYC")).toBe("NYC");
    expect(getJurisdictionTag("FAIRFAX_VA")).toBe("Fairfax County, VA");
    expect(getJurisdictionTag("SPRING_VALLEY_NY")).toBe("Spring Valley, NY");
    expect(getJurisdictionTag("NYS")).toBe("New York State");
    expect(getJurisdictionTag("NYC_NYS_OVERLAP")).toBe("NYC / New York State");
  });

  it("seeds exactly the five live-corpus jurisdictions", () => {
    expect(Object.keys(JURISDICTIONS).sort()).toEqual(
      ["FAIRFAX_VA", "NYC", "NYC_NYS_OVERLAP", "NYS", "SPRING_VALLEY_NY"].sort(),
    );
  });

  it("guards keys and degrades unknown values to NYC — never an invalid string", () => {
    expect(isJurisdictionKey("NYC")).toBe(true);
    expect(isJurisdictionKey("nyc")).toBe(false);
    expect(isJurisdictionKey("Manhattan")).toBe(false);
    expect(isJurisdictionKey(undefined)).toBe(false);

    expect(DEFAULT_JURISDICTION_KEY).toBe("NYC");
    expect(resolveJurisdictionTag(undefined)).toBe("NYC");
    expect(resolveJurisdictionTag("not-a-key")).toBe("NYC");
    expect(resolveJurisdictionTag("FAIRFAX_VA")).toBe("Fairfax County, VA");
  });
});

describe("askBeacon jurisdiction resolution", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({ data: { response: "ok", sources: [] }, error: null });
  });

  const sentJurisdiction = () =>
    (mockInvoke.mock.calls[0][1] as { body: { jurisdiction: string } }).body.jurisdiction;

  it("sends the project jurisdiction's exact tag when present", async () => {
    await askBeacon("q", "u", "n", { jurisdiction: "FAIRFAX_VA" });
    expect(sentJurisdiction()).toBe("Fairfax County, VA");
  });

  it("falls back to the company default when the project has none", async () => {
    await askBeacon("q", "u", "n", undefined, undefined, {
      companyDefaultJurisdiction: "SPRING_VALLEY_NY",
    });
    expect(sentJurisdiction()).toBe("Spring Valley, NY");
  });

  it("degrades to the NYC tag when nothing is provided — never null/invalid", async () => {
    await askBeacon("q", "u", "n");
    expect(sentJurisdiction()).toBe("NYC");
  });
});
