import { describe, it, expect } from "vitest";
import { calculateLineTotal, getDefaultValues, DEFAULT_ITEM } from "@/components/proposals/proposal-dialog/proposalSchema";

describe("proposalSchema", () => {
  describe("calculateLineTotal", () => {
    it("returns 0 for empty item", () => {
      expect(calculateLineTotal({})).toBe(0);
    });

    it("calculates qty * price", () => {
      expect(calculateLineTotal({ quantity: 3, unit_price: 100 })).toBe(300);
    });

    it("applies discount", () => {
      expect(calculateLineTotal({ quantity: 2, unit_price: 100, discount_percent: 10 })).toBe(180);
    });

    it("adds discipline fees", () => {
      expect(calculateLineTotal({ quantity: 1, unit_price: 100, discipline_fee: 50, disciplines: ["Plumbing", "HVAC"] })).toBe(200);
    });

    it("applies discount to subtotal including disciplines", () => {
      const total = calculateLineTotal({ quantity: 1, unit_price: 100, discipline_fee: 50, disciplines: ["Plumbing"], discount_percent: 20 });
      // subtotal = 100 + 50 = 150, discount = 30, total = 120
      expect(total).toBe(120);
    });
  });

  describe("getDefaultValues", () => {
    it("returns default values with empty property_id", () => {
      const vals = getDefaultValues();
      expect(vals.property_id).toBe("");
      expect(vals.items).toHaveLength(1);
      expect(vals.items[0].name).toBe("");
    });

    it("uses provided property id and terms", () => {
      const vals = getDefaultValues("prop-123", "Net 30");
      expect(vals.property_id).toBe("prop-123");
      expect(vals.terms_conditions).toBe("Net 30");
    });
  });

  describe("DEFAULT_ITEM", () => {
    it("has expected shape", () => {
      expect(DEFAULT_ITEM.quantity).toBe(1);
      expect(DEFAULT_ITEM.unit_price).toBe(0);
      expect(DEFAULT_ITEM.fee_type).toBe("fixed");
      expect(DEFAULT_ITEM.is_optional).toBe(false);
    });
  });
});
