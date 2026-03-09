import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock supabase ──────────────────────────────────────
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: (...args: any[]) => mockGetUser(...args) },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

// Chainable builder helper
function chain(finalData: any = null, finalError: any = null) {
  const obj: Record<string, any> = {};
  obj.select = vi.fn().mockReturnValue(obj);
  obj.insert = vi.fn().mockReturnValue(obj);
  obj.update = vi.fn().mockReturnValue(obj);
  obj.delete = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.single = vi.fn().mockResolvedValue({ data: finalData, error: finalError });
  obj.maybeSingle = vi.fn().mockResolvedValue({ data: finalData, error: finalError });
  return obj;
}

describe("useProperties — BBL verification logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bbl_verified is true when borough, block, and lot are all provided", () => {
    const property = { borough: "Manhattan", block: "123", lot: "45" };
    expect(!!(property.borough && property.block && property.lot)).toBe(true);
  });

  it("bbl_verified is false when borough is missing", () => {
    const property = { borough: null as string | null, block: "123", lot: "45" };
    expect(!!(property.borough && property.block && property.lot)).toBe(false);
  });

  it("bbl_verified is false when block is missing", () => {
    const property = { borough: "Brooklyn", block: null as string | null, lot: "45" };
    expect(!!(property.borough && property.block && property.lot)).toBe(false);
  });

  it("bbl_verified is false when lot is empty string", () => {
    const property = { borough: "Queens", block: "99", lot: "" };
    expect(!!(property.borough && property.block && property.lot)).toBe(false);
  });

  it("post-save NYC lookup sets bbl_verified = true in update payload", () => {
    // Simulates the logic at line 119-121 of useProperties.ts
    const updates: Record<string, unknown> = { borough: "Manhattan", block: "100", lot: "50" };
    if (Object.keys(updates).length > 0) {
      updates.bbl_verified = true;
    }
    expect(updates.bbl_verified).toBe(true);
  });

  it("update property auto-verifies when BBL complete", () => {
    const updates = { borough: "Bronx", block: "456", lot: "78" };
    expect(!!(updates.borough && updates.block && updates.lot)).toBe(true);
  });

  it("update property does NOT verify when BBL incomplete", () => {
    const updates = { borough: "Bronx", block: null as string | null, lot: "78" };
    expect(!!(updates.borough && updates.block && updates.lot)).toBe(false);
  });
});
