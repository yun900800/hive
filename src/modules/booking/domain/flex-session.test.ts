import { describe, expect, it } from "vitest";
import type { FlexSession } from "./types";
import { autoEndFlexSession, endFlexSession, markFlexNoShow } from "./flex-session";

function makeSession(overrides: Partial<FlexSession> = {}): FlexSession {
  const checkInAt = new Date("2026-08-03T10:00:00.000Z");
  return {
    id: "s1",
    memberId: "m1",
    zoneId: "zone-A",
    checkInAt,
    checkOutAt: null,
    status: "ACTIVE",
    createdAt: checkInAt,
    updatedAt: checkInAt,
    ...overrides,
  };
}

describe("flex-session 状态机", () => {
  it("ACTIVE → COMPLETED（离场）", () => {
    const r = endFlexSession(
      makeSession(),
      new Date("2026-08-03T12:00:00Z")
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("COMPLETED");
    expect(r.value.checkOutAt?.toISOString()).toBe("2026-08-03T12:00:00.000Z");
  });

  it("ACTIVE → NO_SHOW（边缘）", () => {
    const r = markFlexNoShow(makeSession(), new Date("2026-08-03T12:00:00Z"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("NO_SHOW");
  });

  it("COMPLETED 不能再次离场", () => {
    const r = endFlexSession(
      makeSession({ status: "COMPLETED", checkOutAt: new Date() }),
      new Date("2026-08-03T12:00:00Z")
    );
    expect(r.ok).toBe(false);
  });

  it("NO_SHOW 不能离场", () => {
    const r = endFlexSession(
      makeSession({ status: "NO_SHOW" }),
      new Date("2026-08-03T12:00:00Z")
    );
    expect(r.ok).toBe(false);
  });
});

describe("flex-session 当日结束自动离场", () => {
  // 2026-08-03 23:59:59.999 +08:00
  const validUntil = new Date("2026-08-03T15:59:59.999Z");

  it("未到当日结束不能自动离场", () => {
    const r = autoEndFlexSession(makeSession(), validUntil, new Date(validUntil.getTime() - 1000));
    expect(r.ok).toBe(false);
  });

  it("跨天 → COMPLETED，离场时间记为当日 23:59:59", () => {
    const now = new Date("2026-08-03T16:05:00Z"); // 次日 00:05 +08
    const r = autoEndFlexSession(makeSession(), validUntil, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("COMPLETED");
    expect(r.value.checkOutAt?.toISOString()).toBe(validUntil.toISOString());
    expect(r.value.updatedAt.toISOString()).toBe(now.toISOString());
  });

  it("非 ACTIVE 不能自动离场", () => {
    const r = autoEndFlexSession(
      makeSession({ status: "COMPLETED", checkOutAt: validUntil }),
      validUntil,
      new Date("2026-08-03T16:05:00Z")
    );
    expect(r.ok).toBe(false);
  });
});
