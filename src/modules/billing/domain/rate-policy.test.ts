import { describe, it, expect } from "vitest";
import {
  flexRatePerHourCents,
  memberTierDiscountRate,
  calculateFlexUsage,
  calculateRoomUsage,
  calculateDeskUsage,
  applyFlexMonthlyCap,
  OVERTIME_RATE_PER_HOUR_CENTS,
} from "./rate-policy";

const HOUR_MS = 3_600_000;

describe("flexRatePerHourCents", () => {
  it("费率排序：FLEX ¥15 < FIXED ¥20 < VIRTUAL ¥30", () => {
    expect(flexRatePerHourCents("FLEX_DESK")).toBe(1500);
    expect(flexRatePerHourCents("FIXED_DESK")).toBe(2000);
    expect(flexRatePerHourCents("PRIVATE_OFFICE")).toBe(2000);
    expect(flexRatePerHourCents("VIRTUAL")).toBe(3000);
  });
});

describe("memberTierDiscountRate", () => {
  it("GOLD 9折 / PLATINUM 8折 / BASIC 无折扣 / 未知按无折扣", () => {
    expect(memberTierDiscountRate("BASIC")).toBe(1.0);
    expect(memberTierDiscountRate("GOLD")).toBe(0.9);
    expect(memberTierDiscountRate("PLATINUM")).toBe(0.8);
    expect(memberTierDiscountRate("UNKNOWN")).toBe(1.0);
  });
});

describe("calculateFlexUsage", () => {
  it("免费额度内不收费", () => {
    const charge = calculateFlexUsage({
      durationMs: 3 * HOUR_MS,
      planType: "FLEX_DESK",
      freeFlexHoursMs: 40 * HOUR_MS,
      alreadyUsedMsInMonth: 0,
    });
    expect(charge).toBe(0);
  });

  it("超出免费额度按 ¥15/h 计费（38h 已用 + 3h → 超 1h → ¥15）", () => {
    const charge = calculateFlexUsage({
      durationMs: 3 * HOUR_MS,
      planType: "FLEX_DESK",
      freeFlexHoursMs: 40 * HOUR_MS,
      alreadyUsedMsInMonth: 38 * HOUR_MS,
    });
    expect(charge).toBe(1500); // ¥15
  });

  it("免费额度耗尽后 FIXED_DESK 按 ¥20/h", () => {
    const charge = calculateFlexUsage({
      durationMs: 2 * HOUR_MS,
      planType: "FIXED_DESK",
      freeFlexHoursMs: 0,
      alreadyUsedMsInMonth: 0,
    });
    expect(charge).toBe(4000); // ¥40
  });

  it("VIRTUAL 无免费额度按 ¥30/h", () => {
    const charge = calculateFlexUsage({
      durationMs: 2 * HOUR_MS,
      planType: "VIRTUAL",
      freeFlexHoursMs: 0,
      alreadyUsedMsInMonth: 0,
    });
    expect(charge).toBe(6000); // ¥60
  });

  it("免费额度剩余不足时只对超出部分计费", () => {
    const charge = calculateFlexUsage({
      durationMs: 2 * HOUR_MS, // 2h
      planType: "FLEX_DESK",
      freeFlexHoursMs: 40 * HOUR_MS,
      alreadyUsedMsInMonth: 39 * HOUR_MS, // 只剩 1h 免费
    });
    expect(charge).toBe(1500); // 超 1h × ¥15
  });

  it("小数时长按比例计费（30min 超额度 → ¥7.50）", () => {
    const charge = calculateFlexUsage({
      durationMs: 0.5 * HOUR_MS,
      planType: "VIRTUAL",
      freeFlexHoursMs: 0,
      alreadyUsedMsInMonth: 0,
    });
    expect(charge).toBe(1500); // 0.5h × ¥30 = ¥15
  });
});

describe("calculateRoomUsage", () => {
  it("预订 1h 按 ¥30/h 计费", () => {
    expect(calculateRoomUsage({ bookedDurationMs: HOUR_MS, hourlyRateCents: 3000 })).toBe(3000);
  });

  it("提前结束（0.5h）仍按预订时长整小时计费", () => {
    expect(calculateRoomUsage({ bookedDurationMs: 0.5 * HOUR_MS, hourlyRateCents: 3000 })).toBe(3000);
  });

  it("1.5h ceil 到 2h", () => {
    expect(calculateRoomUsage({ bookedDurationMs: 1.5 * HOUR_MS, hourlyRateCents: 3000 })).toBe(6000);
  });
});

describe("calculateDeskUsage", () => {
  it("固定工位已含在套餐内，恒为 ¥0", () => {
    expect(calculateDeskUsage()).toBe(0);
  });
});

describe("applyFlexMonthlyCap", () => {
  it("未超封顶时保持原额", () => {
    expect(applyFlexMonthlyCap({ flexTotalCents: 5000, monthlyFeeCents: 49900 })).toBe(5000);
  });

  it("超封顶时截断到月费 120%（¥499 → ¥598.8）", () => {
    expect(applyFlexMonthlyCap({ flexTotalCents: 100000, monthlyFeeCents: 49900 })).toBe(
      Math.round(49900 * 1.2)
    );
  });
});

describe("OVERTIME_RATE_PER_HOUR_CENTS", () => {
  it("超时费率统一 ¥80/h", () => {
    expect(OVERTIME_RATE_PER_HOUR_CENTS).toBe(8000);
  });
});
