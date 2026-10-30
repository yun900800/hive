/**
 * Access 领域单测。
 */

import { describe, it, expect } from "vitest";
import {
  canGrantAccess,
  markPassUsed,
  revokePass,
  isExpired,
  generatePassCode,
} from "./gate-pass";
import type { GatePass } from "./types";

function makePass(overrides: Partial<GatePass> = {}): GatePass {
  return {
    id: "p1",
    code: "GP-ABC123",
    memberId: "m1",
    bookingId: "b1",
    gatePassType: "DESK",
    validFrom: new Date(2026, 7, 20, 9, 0),
    validTo: new Date(2026, 7, 20, 18, 0),
    status: "ACTIVE",
    createdAt: new Date(2026, 7, 19),
    ...overrides,
  };
}

describe("canGrantAccess", () => {
  const pass = makePass();
  it("有效期内 ACTIVE → GRANTED", () => {
    const r = canGrantAccess(pass, new Date(2026, 7, 20, 10, 0));
    expect(r.granted).toBe(true);
    expect(r.result).toBe("GRANTED");
  });

  it("REVOKED → DENIED_REVOKED", () => {
    const r = canGrantAccess(makePass({ status: "REVOKED" }), new Date(2026, 7, 20, 10, 0));
    expect(r.result).toBe("DENIED_REVOKED");
  });

  it("非 ACTIVE（USED）→ DENIED_NO_BOOKING", () => {
    const r = canGrantAccess(makePass({ status: "USED" }), new Date(2026, 7, 20, 10, 0));
    expect(r.result).toBe("DENIED_NO_BOOKING");
  });

  it("EXPIRED 状态 → DENIED_EXPIRED", () => {
    const r = canGrantAccess(makePass({ status: "EXPIRED" }), new Date(2026, 7, 20, 10, 0));
    expect(r.result).toBe("DENIED_EXPIRED");
  });

  it("超出授权时段 → DENIED_EXPIRED", () => {
    const r = canGrantAccess(pass, new Date(2026, 7, 20, 19, 0));
    expect(r.result).toBe("DENIED_EXPIRED");
  });

  it("时段开始前 → DENIED_NOT_STARTED（不是过期）", () => {
    const r = canGrantAccess(pass, new Date(2026, 7, 20, 8, 0));
    expect(r.result).toBe("DENIED_NOT_STARTED");
  });

  it("时段开始前一分钟 → DENIED_NOT_STARTED", () => {
    const r = canGrantAccess(pass, new Date(2026, 7, 20, 8, 59));
    expect(r.result).toBe("DENIED_NOT_STARTED");
  });

  it("边界时刻：正好 validFrom（9:00）可通行", () => {
    const r = canGrantAccess(pass, new Date(2026, 7, 20, 9, 0));
    expect(r.result).toBe("GRANTED");
  });

  it("边界时刻：正好 validTo（18:00）可通行", () => {
    const r = canGrantAccess(pass, new Date(2026, 7, 20, 18, 0));
    expect(r.result).toBe("GRANTED");
  });
});

describe("markPassUsed / revokePass / isExpired", () => {
  it("markPassUsed → USED", () => {
    expect(markPassUsed(makePass()).status).toBe("USED");
  });

  it("revokePass → REVOKED；幂等", () => {
    const revoked = revokePass(makePass());
    expect(revoked.status).toBe("REVOKED");
    expect(revokePass(revoked).status).toBe("REVOKED");
  });

  it("isExpired：时段过后 ACTIVE → true", () => {
    expect(isExpired(makePass(), new Date(2026, 7, 20, 19, 0))).toBe(true);
    expect(isExpired(makePass(), new Date(2026, 7, 20, 10, 0))).toBe(false);
  });
});

describe("generatePassCode", () => {
  it("GP- 前缀 + booking 简写", () => {
    const code = generatePassCode("123e4567-e89b-42d3-a456-426614174000");
    expect(code).toMatch(/^GP-[A-F0-9]{8}$/);
  });
});
