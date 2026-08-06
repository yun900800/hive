import { describe, expect, it } from "vitest";
import type { DeskBooking } from "./types";
import {
  confirmBooking,
  checkInDeskBooking,
  checkOutDeskBooking,
  cancelDeskBooking,
  markDeskNoShow,
} from "./desk-booking";
import { CANCEL_WINDOW_MS, NO_SHOW_GRACE_MS } from "./policies";

const MIN = 60_000;

function makeBooking(overrides: Partial<DeskBooking> = {}): DeskBooking {
  const startTime = new Date("2026-08-03T09:00:00.000Z");
  return {
    id: "b1",
    memberId: "m1",
    deskId: "desk-B-12",
    startTime,
    endTime: new Date("2026-08-03T18:00:00.000Z"),
    status: "CONFIRMED",
    checkedInAt: null,
    checkedOutAt: null,
    cancelledAt: null,
    createdAt: startTime,
    updatedAt: startTime,
    ...overrides,
  };
}

describe("desk-booking 状态机：全合法流转", () => {
  it("PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT", () => {
    const pending = makeBooking({ status: "PENDING" });
    const r1 = confirmBooking(pending, new Date("2026-08-03T08:00:00Z"));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.status).toBe("CONFIRMED");

    const r2 = checkInDeskBooking(r1.value, new Date("2026-08-03T09:01:00Z"));
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.value.status).toBe("CHECKED_IN");
    expect(r2.value.checkedInAt?.toISOString()).toBe("2026-08-03T09:01:00.000Z");

    const r3 = checkOutDeskBooking(r2.value, new Date("2026-08-03T18:05:00Z"));
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect(r3.value.status).toBe("CHECKED_OUT");
    expect(r3.value.checkedOutAt?.toISOString()).toBe("2026-08-03T18:05:00.000Z");
  });

  it("CONFIRMED → CANCELLED（开始前 30 分钟以上）", () => {
    const r = cancelDeskBooking(
      makeBooking(),
      new Date("2026-08-03T08:20:00Z") // 距开始 40 分钟
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("CANCELLED");
    expect(r.value.cancelledAt?.toISOString()).toBe("2026-08-03T08:20:00.000Z");
  });

  it("CONFIRMED → NO_SHOW（超过开始 15 分钟后）", () => {
    const r = markDeskNoShow(
      makeBooking(),
      new Date("2026-08-03T09:20:00Z") // 开始后 20 分钟
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("NO_SHOW");
  });

  it("PENDING 可直接取消", () => {
    const r = cancelDeskBooking(
      makeBooking({ status: "PENDING" }),
      new Date("2026-08-03T08:00:00Z")
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("CANCELLED");
  });
});

describe("desk-booking 状态机：非法流转拒绝", () => {
  it("未确认不能签到", () => {
    const r = checkInDeskBooking(
      makeBooking({ status: "PENDING" }),
      new Date("2026-08-03T09:00:00Z")
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/CONFIRMED/);
  });

  it("未签到不能签退", () => {
    const r = checkOutDeskBooking(
      makeBooking(), // CONFIRMED
      new Date("2026-08-03T18:00:00Z")
    );
    expect(r.ok).toBe(false);
  });

  it("CHECKED_OUT 不能再签退", () => {
    const r = checkOutDeskBooking(
      makeBooking({ status: "CHECKED_OUT" }),
      new Date("2026-08-03T18:00:00Z")
    );
    expect(r.ok).toBe(false);
  });

  it("CHECKED_IN 不能取消（已使用不能取消）", () => {
    const r = cancelDeskBooking(
      makeBooking({ status: "CHECKED_IN" }),
      new Date("2026-08-03T08:00:00Z")
    );
    expect(r.ok).toBe(false);
  });

  it("NO_SHOW 状态不能签到", () => {
    const r = checkInDeskBooking(
      makeBooking({ status: "NO_SHOW" }),
      new Date("2026-08-03T09:00:00Z")
    );
    expect(r.ok).toBe(false);
  });

  it("CHECKED_OUT 不能标记 NO_SHOW", () => {
    const r = markDeskNoShow(
      makeBooking({ status: "CHECKED_OUT" }),
      new Date("2026-08-03T10:00:00Z")
    );
    expect(r.ok).toBe(false);
  });
});

describe("desk-booking 取消窗口边界", () => {
  it("恰好开始前 30 分钟可取消（<= 允许）", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    const r = cancelDeskBooking(
      makeBooking({ startTime: start }),
      new Date(start.getTime() - CANCEL_WINDOW_MS)
    );
    expect(r.ok).toBe(true);
  });

  it("开始前 29 分钟不可取消", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    const r = cancelDeskBooking(
      makeBooking({ startTime: start }),
      new Date(start.getTime() - CANCEL_WINDOW_MS + MIN)
    );
    expect(r.ok).toBe(false);
  });
});

describe("desk-booking NoShow 边界", () => {
  it("恰好开始后 15 分钟尚未判定（严格 >）", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    const r = markDeskNoShow(
      makeBooking({ startTime: start }),
      new Date(start.getTime() + NO_SHOW_GRACE_MS)
    );
    expect(r.ok).toBe(false);
  });

  it("开始后 15 分钟零 1 秒判定 NO_SHOW", () => {
    const start = new Date("2026-08-03T09:00:00Z");
    const r = markDeskNoShow(
      makeBooking({ startTime: start }),
      new Date(start.getTime() + NO_SHOW_GRACE_MS + 1000)
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("NO_SHOW");
  });
});
