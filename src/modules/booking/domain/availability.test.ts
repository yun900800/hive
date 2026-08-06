import { describe, expect, it } from "vitest";
import { TimeSlot } from "@/shared";
import { hasOverlapWithExisting, findConflictingSlot, isConflictingStatus } from "./availability";

const slot = (start: string, end: string) =>
  TimeSlot.of(new Date(start), new Date(end));

function occupied(start: string, end: string, status: string) {
  return { startTime: new Date(start), endTime: new Date(end), status };
}

describe("availability 可用性冲突校验", () => {
  it("同一资源相同时段重叠 → 冲突", () => {
    const requested = slot("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z");
    const existing = [occupied("2026-08-03T09:30:00Z", "2026-08-03T10:30:00Z", "CONFIRMED")];
    expect(hasOverlapWithExisting(requested, existing)).toBe(true);
  });

  it("请求时段被已有预订完全包含 → 冲突", () => {
    const requested = slot("2026-08-03T10:00:00Z", "2026-08-03T11:00:00Z");
    const existing = [occupied("2026-08-03T09:00:00Z", "2026-08-03T12:00:00Z", "CHECKED_IN")];
    expect(hasOverlapWithExisting(requested, existing)).toBe(true);
  });

  it("相邻不重叠（边界相接）→ 不冲突", () => {
    const requested = slot("2026-08-03T11:00:00Z", "2026-08-03T12:00:00Z");
    const existing = [occupied("2026-08-03T10:00:00Z", "2026-08-03T11:00:00Z", "CONFIRMED")];
    expect(hasOverlapWithExisting(requested, existing)).toBe(false);
  });

  it("CHECKED_OUT / COMPLETED / CANCELLED / NO_SHOW 不构成冲突", () => {
    const requested = slot("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z");
    const existing = [
      occupied("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z", "CHECKED_OUT"),
      occupied("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z", "COMPLETED"),
      occupied("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z", "CANCELLED"),
      occupied("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z", "NO_SHOW"),
    ];
    expect(hasOverlapWithExisting(requested, existing)).toBe(false);
  });

  it("PENDING 同样构成冲突（占用资源）", () => {
    const requested = slot("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z");
    const existing = [occupied("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z", "PENDING")];
    expect(hasOverlapWithExisting(requested, existing)).toBe(true);
  });

  it("findConflictingSlot 返回第一条冲突，无冲突返回 null", () => {
    const requested = slot("2026-08-03T09:00:00Z", "2026-08-03T10:00:00Z");
    const existing = [
      occupied("2026-08-03T08:00:00Z", "2026-08-03T08:30:00Z", "COMPLETED"),
      occupied("2026-08-03T09:15:00Z", "2026-08-03T09:45:00Z", "CONFIRMED"),
    ];
    const hit = findConflictingSlot(requested, existing);
    expect(hit?.status).toBe("CONFIRMED");

    const none = findConflictingSlot(requested, [
      occupied("2026-08-03T08:00:00Z", "2026-08-03T08:30:00Z", "COMPLETED"),
    ]);
    expect(none).toBeNull();
  });

  it("isConflictingStatus 状态分类", () => {
    expect(isConflictingStatus("PENDING")).toBe(true);
    expect(isConflictingStatus("CONFIRMED")).toBe(true);
    expect(isConflictingStatus("CHECKED_IN")).toBe(true);
    expect(isConflictingStatus("IN_PROGRESS")).toBe(true);
    expect(isConflictingStatus("CHECKED_OUT")).toBe(false);
    expect(isConflictingStatus("COMPLETED")).toBe(false);
    expect(isConflictingStatus("CANCELLED")).toBe(false);
    expect(isConflictingStatus("NO_SHOW")).toBe(false);
  });
});
