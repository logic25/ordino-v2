import { describe, expect, it } from "vitest";
import { calculateBilledAmount, formatRemainingBalanceDescription } from "./billingCalculations";

describe("billingCalculations", () => {
  it("calculates percentage billing from the remaining balance", () => {
    expect(calculateBilledAmount({ billingMode: "percent", inputValue: 50, remaining: 1300 })).toBe(650);
  });

  it("caps amount billing at the remaining balance", () => {
    expect(calculateBilledAmount({ billingMode: "amount", inputValue: 1700, remaining: 1300 })).toBe(1300);
  });

  it("describes percentage billing against the remaining balance", () => {
    expect(formatRemainingBalanceDescription(50, 1300)).toBe("50% of remaining balance $1,300.00");
  });
});