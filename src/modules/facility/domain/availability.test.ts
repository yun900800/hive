import { describe, expect, it } from "vitest";
import { isDeskAvailable, isRoomAvailable, hasSlotConflict } from "./availability";
import { TimeSlot } from "@/shared";

describe("facility availability", () => {
  it("只有 AVAILABLE 工位可预订", () => {
    expect(isDeskAvailable("AVAILABLE")).toBe(true);
    expect(isDeskAvailable("OCCUPIED")).toBe(false);
    expect(isDeskAvailable("RESERVED")).toBe(false);
    expect(isDeskAvailable("UNDER_MAINTENANCE")).toBe(false);
  });

  it("只有 AVAILABLE 会议室可预订", () => {
    expect(isRoomAvailable("AVAILABLE")).toBe(true);
    expect(isRoomAvailable("IN_USE")).toBe(false);
    expect(isRoomAvailable("UNDER_MAINTENANCE")).toBe(false);
  });

  it("时段冲突判断", () => {
    const a = TimeSlot.of(new Date(2026, 7, 1, 9), new Date(2026, 7, 1, 12));
    const b = TimeSlot.of(new Date(2026, 7, 1, 11), new Date(2026, 7, 1, 13));
    const c = TimeSlot.of(new Date(2026, 7, 1, 12), new Date(2026, 7, 1, 13));
    expect(hasSlotConflict(a, b)).toBe(true);
    expect(hasSlotConflict(a, c)).toBe(false);
  });
});
