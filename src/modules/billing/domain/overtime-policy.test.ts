import { describe, it, expect } from "vitest";
import { calculateRoomOvertime, hasChargeableOvertime } from "./overtime-policy";
import { GRACE_PERIOD_MS, GRACE_PERIOD_MINUTES } from "./grace-period";

function at(h: number, min = 0): Date {
  const d = new Date(2026, 7, 20);
  d.setHours(h, min, 0, 0);
  return d;
}

describe("GracePeriod", () => {
  it("免罚期为 15 分钟", () => {
    expect(GRACE_PERIOD_MINUTES).toBe(15);
    expect(GRACE_PERIOD_MS).toBe(15 * 60 * 1000);
  });
});

describe("calculateRoomOvertime", () => {
  it("超时 45min（免罚 15 → 计费 30min）→ ¥40", () => {
    const charge = calculateRoomOvertime({
      bookedEndTime: at(15, 0),
      actualEndTime: at(15, 45),
    });
    expect(charge).toBe(4000); // 0.5h × ¥80
  });

  it("超时 ≤15min（10min）→ ¥0", () => {
    const charge = calculateRoomOvertime({
      bookedEndTime: at(15, 0),
      actualEndTime: at(15, 10),
    });
    expect(charge).toBe(0);
  });

  it("恰好免罚期边界（15min）→ ¥0", () => {
    const charge = calculateRoomOvertime({
      bookedEndTime: at(15, 0),
      actualEndTime: new Date(at(15, 0).getTime() + GRACE_PERIOD_MS),
    });
    expect(charge).toBe(0);
  });

  it("准时结束 → ¥0", () => {
    const charge = calculateRoomOvertime({
      bookedEndTime: at(15, 0),
      actualEndTime: at(15, 0),
    });
    expect(charge).toBe(0);
  });

  it("提前结束 → ¥0", () => {
    const charge = calculateRoomOvertime({
      bookedEndTime: at(15, 0),
      actualEndTime: at(14, 50),
    });
    expect(charge).toBe(0);
  });

  it("超时 20min（免罚 15 → 计费 5min）→ ¥80×5/60 ≈ ¥6.67", () => {
    const charge = calculateRoomOvertime({
      bookedEndTime: at(15, 0),
      actualEndTime: at(15, 20),
    });
    expect(charge).toBe(Math.round((5 / 60) * 8000)); // ¥6.67
  });

  it("超时 1.5h（免罚 15 → 计费 75min）→ ¥100", () => {
    const charge = calculateRoomOvertime({
      bookedEndTime: at(15, 0),
      actualEndTime: at(16, 30),
    });
    expect(charge).toBe(Math.round((75 / 60) * 8000)); // 1.25h × ¥80 = ¥100
  });
});

describe("hasChargeableOvertime", () => {
  it("超出免罚期才判定可计费", () => {
    expect(hasChargeableOvertime({ bookedEndTime: at(15, 0), actualEndTime: at(15, 10) })).toBe(false);
    expect(hasChargeableOvertime({ bookedEndTime: at(15, 0), actualEndTime: at(15, 45) })).toBe(true);
  });
});
