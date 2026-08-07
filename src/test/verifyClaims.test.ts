import { describe, it, expect } from "vitest";
import { scanForUnsupportedClaims, hasVerifyMarkers, countVerifyMarkers } from "@/lib/verifyClaims";

describe("verifyClaims", () => {
  it("flags a verification claim when no sheet is pinned", () => {
    const res = scanForUnsupportedClaims(
      "Rear yard compliance has been verified and confirmed on the drawings."
    );
    expect(res.markers.length).toBeGreaterThan(0);
    expect(hasVerifyMarkers(res.text)).toBe(true);
  });

  it("flags dimension and compliance claims", () => {
    const res = scanForUnsupportedClaims("The rear yard is dimensioned on the site plan; the layout complies with ZR 23-47.");
    expect(res.markers.length).toBe(2);
  });

  it("leaves neutral reasoning alone", () => {
    const text = "The lot is a corner lot, so ZR 23-711 governs rather than the cited section.";
    const res = scanForUnsupportedClaims(text);
    expect(res.markers).toHaveLength(0);
    expect(res.text).toBe(text);
  });

  it("allows a claim citing a pinned sheet", () => {
    const res = scanForUnsupportedClaims(
      "The rear yard is dimensioned on sheet Z-1.",
      ["Z-1"]
    );
    expect(res.markers).toHaveLength(0);
  });

  it("still flags a claim citing a sheet that is not pinned", () => {
    const res = scanForUnsupportedClaims(
      "The rear yard is dimensioned on sheet A-101.",
      ["Z-1"]
    );
    expect(res.markers).toHaveLength(1);
  });

  it("does not double-wrap existing markers", () => {
    const first = scanForUnsupportedClaims("The yard complies with the code.");
    const second = scanForUnsupportedClaims(first.text);
    expect(countVerifyMarkers(second.text)).toBe(1);
  });
});
