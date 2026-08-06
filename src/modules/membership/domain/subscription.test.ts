import { describe, expect, it } from "vitest";
import { isSubscriptionActive, prorateMonthlyFee } from "./subscription";

describe("membership subscription", () => {
  it("只有 ACTIVE 生效", () => {
    expect(isSubscriptionActive("ACTIVE")).toBe(true);
    expect(isSubscriptionActive("CANCELLED")).toBe(false);
    expect(isSubscriptionActive("EXPIRED")).toBe(false);
    expect(isSubscriptionActive("SUSPENDED")).toBe(false);
  });

  it("月中开通按剩余天数折算月费", () => {
    // 8 月 31 天；15 号开通剩余 17 天（含当天）
    const startDate = new Date(2026, 7, 15);
    const month = new Date(2026, 7, 1);
    // ¥899 × 17/31 ≈ 493.06
    const prorated = prorateMonthlyFee(89900, startDate, month);
    expect(prorated).toBeGreaterThan(49000);
    expect(prorated).toBeLessThan(50000);
  });

  it("月初开通全额", () => {
    const startDate = new Date(2026, 7, 1);
    const month = new Date(2026, 7, 1);
    expect(prorateMonthlyFee(89900, startDate, month)).toBe(89900);
  });

  it("上月已开通（月中查询）按当月全月折算", () => {
    // 7/20 开通，8 月账单应全月
    const startDate = new Date(2026, 6, 20);
    const month = new Date(2026, 7, 1);
    expect(prorateMonthlyFee(89900, startDate, month)).toBe(89900);
  });
});
