import { describe, expect, it } from "vitest";
import { TimeSlot } from "@/shared/time-slot";

const at = (h: number, m = 0, d = 1) => new Date(2026, 7, d, h, m);

describe("TimeSlot", () => {
  it("构建正常时段", () => {
    const slot = TimeSlot.of(at(9), at(18));
    expect(slot.durationHours()).toBe(9);
  });

  it("起止时间非法抛错", () => {
    expect(() => TimeSlot.of(at(18), at(9))).toThrow(/after startTime/);
  });

  it("重叠判断", () => {
    const a = TimeSlot.of(at(9), at(12));
    expect(a.overlapsWith(TimeSlot.of(at(11), at(13)))).toBe(true);
    expect(a.overlapsWith(TimeSlot.of(at(12), at(13)))).toBe(false);
    expect(a.overlapsWith(TimeSlot.of(at(8), at(9)))).toBe(false);
  });

  it("isBefore 判断", () => {
    expect(TimeSlot.of(at(9), at(12)).isBefore(at(10))).toBe(true);
    expect(TimeSlot.of(at(9), at(12)).isBefore(at(8))).toBe(false);
  });
});
