import { describe, expect, it } from "vitest";
import type { RoomBooking } from "./types";
import {
  confirmRoomBooking,
  startRoomBooking,
  completeRoomBooking,
  autoCompleteRoomBooking,
  cancelRoomBooking,
} from "./room-booking";
import { AUTO_COMPLETE_GRACE_MS } from "./policies";

function makeBooking(overrides: Partial<RoomBooking> = {}): RoomBooking {
  const startTime = new Date("2026-08-03T14:00:00.000Z");
  return {
    id: "r1",
    memberId: "m1",
    roomId: "room-1",
    startTime,
    endTime: new Date("2026-08-03T15:00:00.000Z"),
    expectedAttendees: 4,
    status: "CONFIRMED",
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: startTime,
    updatedAt: startTime,
    ...overrides,
  };
}

describe("room-booking 状态机：全合法流转", () => {
  it("PENDING → CONFIRMED → IN_PROGRESS → COMPLETED", () => {
    const pending = makeBooking({ status: "PENDING" });
    const r1 = confirmRoomBooking(pending, new Date("2026-08-03T10:00:00Z"));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.status).toBe("CONFIRMED");

    const r2 = startRoomBooking(r1.value, new Date("2026-08-03T14:00:00Z"));
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.value.status).toBe("IN_PROGRESS");
    expect(r2.value.startedAt?.toISOString()).toBe("2026-08-03T14:00:00.000Z");

    const r3 = completeRoomBooking(r2.value, new Date("2026-08-03T15:00:00Z"));
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    expect(r3.value.status).toBe("COMPLETED");
    expect(r3.value.completedAt?.toISOString()).toBe("2026-08-03T15:00:00.000Z");
  });

  it("CONFIRMED → CANCELLED", () => {
    const r = cancelRoomBooking(
      makeBooking(),
      new Date("2026-08-03T13:00:00Z")
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("CANCELLED");
  });
});

describe("room-booking 状态机：非法流转拒绝", () => {
  it("PENDING 不能开始使用", () => {
    const r = startRoomBooking(
      makeBooking({ status: "PENDING" }),
      new Date("2026-08-03T14:00:00Z")
    );
    expect(r.ok).toBe(false);
  });

  it("IN_PROGRESS 不能重复开始", () => {
    const r = startRoomBooking(
      makeBooking({ status: "IN_PROGRESS", startedAt: new Date() }),
      new Date("2026-08-03T14:00:00Z")
    );
    expect(r.ok).toBe(false);
  });

  it("COMPLETED 不能再次完成", () => {
    const r = completeRoomBooking(
      makeBooking({ status: "COMPLETED", completedAt: new Date() }),
      new Date("2026-08-03T15:00:00Z")
    );
    expect(r.ok).toBe(false);
  });

  it("IN_PROGRESS 不能取消", () => {
    const r = cancelRoomBooking(
      makeBooking({ status: "IN_PROGRESS" }),
      new Date("2026-08-03T14:30:00Z")
    );
    expect(r.ok).toBe(false);
  });
});

describe("room-booking 到点自动完成", () => {
  const end = new Date("2026-08-03T15:00:00Z");
  const inProgress = makeBooking({
    status: "IN_PROGRESS",
    endTime: end,
    startedAt: new Date("2026-08-03T14:02:00Z"),
  });

  it("未到预订结束不能自动完成", () => {
    const r = autoCompleteRoomBooking(inProgress, new Date(end.getTime() - 1000));
    expect(r.ok).toBe(false);
  });

  it("结束 + 宽限期内不自动完成", () => {
    const r = autoCompleteRoomBooking(inProgress, new Date(end.getTime() + AUTO_COMPLETE_GRACE_MS));
    expect(r.ok).toBe(false);
  });

  it("超过结束 + 宽限期 → COMPLETED，完成时间记为 endTime（无超时费）", () => {
    const now = new Date(end.getTime() + AUTO_COMPLETE_GRACE_MS + 1000);
    const r = autoCompleteRoomBooking(inProgress, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("COMPLETED");
    expect(r.value.completedAt?.toISOString()).toBe(end.toISOString());
    expect(r.value.updatedAt.toISOString()).toBe(now.toISOString());
  });

  it("非 IN_PROGRESS 不能自动完成", () => {
    const r = autoCompleteRoomBooking(
      makeBooking({ status: "CONFIRMED", endTime: end }),
      new Date(end.getTime() + 60 * 60_000)
    );
    expect(r.ok).toBe(false);
  });
});
