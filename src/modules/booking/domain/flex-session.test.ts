import { describe, expect, it } from "vitest";
import type { FlexSession } from "./types";
import { endFlexSession, markFlexNoShow } from "./flex-session";

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
