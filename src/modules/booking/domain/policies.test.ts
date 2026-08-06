import { describe, expect, it } from "vitest";
import { canCancel, isNoShow, CANCEL_WINDOW_MS, NO_SHOW_GRACE_MS } from "./policies";

const MIN = 60_000;

describe("booking policies", () => {
  it("canCancel：取消时刻 ≤ 开始前 30 分钟 → true", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    expect(canCancel({ startTime: start }, new Date(start.getTime() - 2 * 3600_000))).toBe(true);
  });

  it("canCancel：恰好开始前 30 分钟 → true（临界允许）", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    expect(canCancel({ startTime: start }, new Date(start.getTime() - CANCEL_WINDOW_MS))).toBe(true);
  });

  it("canCancel：开始前 29 分钟 → false", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    expect(canCancel({ startTime: start }, new Date(start.getTime() - CANCEL_WINDOW_MS + MIN))).toBe(false);
  });

  it("canCancel：已开始 → false", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    expect(canCancel({ startTime: start }, new Date("2026-08-03T09:30:00Z"))).toBe(false);
  });

  it("isNoShow：CONFIRMED 且超过开始后 15 分钟 → true", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    expect(isNoShow({ status: "CONFIRMED", startTime: start }, new Date(start.getTime() + NO_SHOW_GRACE_MS + 1000))).toBe(true);
  });

  it("isNoShow：恰好开始后 15 分钟 → false（严格 >）", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    expect(isNoShow({ status: "CONFIRMED", startTime: start }, new Date(start.getTime() + NO_SHOW_GRACE_MS))).toBe(false);
  });

  it("isNoShow：非 CONFIRMED 即使超时 → false", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    expect(isNoShow({ status: "CHECKED_IN", startTime: start }, new Date(start.getTime() + 3600_000))).toBe(false);
  });

  it("isNoShow：未超时 → false", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    expect(isNoShow({ status: "CONFIRMED", startTime: start }, new Date("2026-08-03T09:05:00Z"))).toBe(false);
  });
});
