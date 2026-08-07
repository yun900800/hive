import { describe, expect, it } from "vitest";
import { getTierDiscount, applyTierDiscount } from "./tier";

describe("membership tier", () => {
  it("等级折扣：SILVER 95折、GOLD 9折、PLATINUM 8折", () => {
    expect(getTierDiscount("BASIC")).toBe(1);
    expect(getTierDiscount("SILVER")).toBe(0.95);
    expect(getTierDiscount("GOLD")).toBe(0.9);
    expect(getTierDiscount("PLATINUM")).toBe(0.8);
  });

  it("应用折扣：FIXED_DESK ¥899 × SILVER 0.95 = ¥854", () => {
    expect(applyTierDiscount(89900, "SILVER")).toBe(85405); // ¥854.05
  });

  it("应用折扣：FIXED_DESK ¥899 × GOLD 0.9 = ¥809", () => {
    expect(applyTierDiscount(89900, "GOLD")).toBe(80910); // ¥809.10
  });

  it("应用折扣：FIXED_DESK ¥899 × PLATINUM 0.8 = ¥719", () => {
    expect(applyTierDiscount(89900, "PLATINUM")).toBe(71920); // ¥719.20
  });

  it("折扣金额四舍五入到分", () => {
    expect(applyTierDiscount(3333, "GOLD")).toBe(3000); // 2999.7 → 3000
  });
});
