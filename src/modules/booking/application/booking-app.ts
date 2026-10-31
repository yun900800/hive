import { eq, and, desc, sql, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  deskBookings,
  roomBookings,
  flexSessions,
  members,
  desks,
  meetingRooms,
  flexZones,
  resourceLocks,
} from "@/lib/db/schema";
import { TimeSlot } from "@/shared";
import { createEvent } from "@/shared/events";
import { appendOutboxEvents } from "@/shared/outbox";
import { getActiveSubscription } from "@/modules/membership/application/membership-app";
import * as deskSM from "../domain/desk-booking";
import * as roomSM from "../domain/room-booking";
import * as flexSM from "../domain/flex-session";
import { hasOverlapWithExisting } from "../domain/availability";
import { AUTO_CHECK_OUT_GRACE_MS, NO_SHOW_GRACE_MS } from "../domain/policies";
import type { DeskBooking, RoomBooking, FlexSession } from "../domain/types";

/**
 * BookingApplicationService — 预订用例编排。
 * 领域规则由 domain/ 状态机纯函数保证；持久化与事件落库在本层完成。
 */

// ---------- 通用工具 ----------

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function requireOwner<T extends { memberId: string }>(
  row: T | undefined,
  memberId: string
): T {
  if (!row) throw new Error("记录不存在");
  if (row.memberId !== memberId) throw new Error("无权操作他人的预订");
  return row;
}

function asSlot(startTime: Date, endTime: Date): TimeSlot {
  return TimeSlot.of(startTime, endTime);
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(message);
}

function isBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_BUSY|database is locked/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withBusyRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isBusy(error)) throw error;
      lastError = error;
      await sleep(20 * 2 ** attempt);
    }
  }
  throw lastError;
}

/**
 * 在资源级串行化一个预订用例。
 *
 * 为什么不能只靠 `SELECT 冲突 → INSERT`：两者不在同一事务时，并发请求会各自
 * 读到"无冲突"然后都写入，同一工位/会议室被双卖。
 * 这里先对 resource_lock 做一次 upsert —— 它是写操作，会强制本事务拿到写锁，
 * 同一资源的并发事务因此被数据库串行化；锁内再校验冲突才是安全的。
 */
async function withResourceLock<T>(
  resourceId: string,
  fn: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  return withBusyRetry(() =>
    db.transaction(async (tx) => {
      await tx
        .insert(resourceLocks)
        .values({ resourceId })
        .onConflictDoUpdate({
          target: resourceLocks.resourceId,
          set: { version: sql`${resourceLocks.version} + 1` },
        })
        .run();

      return fn(tx);
    })
  );
}

// ---------- 订阅资格 ----------

async function assertSubscriptionEligible(
  memberId: string,
  allowedPlanTypes: string[]
): Promise<void> {
  const sub = await getActiveSubscription(memberId);
  if (!sub) throw new Error("请先订阅套餐");
  if (!allowedPlanTypes.includes(sub.planType)) {
    throw new Error(`当前套餐 ${sub.planType} 不具备此权限`);
  }
}

// ---------- 工位预订 ----------

export type CreateDeskBookingInput = {
  memberId: string;
  deskId: string;
  startTime: Date;
  endTime: Date;
};

export async function createDeskBooking(
  input: CreateDeskBookingInput
): Promise<DeskBooking> {
  const slot = asSlot(input.startTime, input.endTime);
  if (slot.isBefore(new Date())) {
    throw new Error("预订开始时间不能早于当前时间");
  }

  // 订阅资格：FIXED_DESK / PRIVATE_OFFICE
  await assertSubscriptionEligible(input.memberId, ["FIXED_DESK", "PRIVATE_OFFICE"]);

  // 工位存在且可订
  const desk = await db.select().from(desks).where(eq(desks.id, input.deskId)).get();
  if (!desk) throw new Error("工位不存在");
  if (desk.status !== "AVAILABLE") throw new Error("工位当前不可预订");

  const now = new Date();
  const created: DeskBooking = {
    id: crypto.randomUUID(),
    memberId: input.memberId,
    deskId: input.deskId,
    startTime: input.startTime,
    endTime: input.endTime,
    status: "PENDING",
    checkedInAt: null,
    checkedOutAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
  };

  // 创建即确认（PENDING → CONFIRMED）
  const confirmed = deskSM.confirmBooking(created, now);
  if (!confirmed.ok) throw new Error(confirmed.error);
  const row = confirmed.value;

  const event = createEvent({
    eventType: "booking.booking-confirmed",
    aggregateId: row.id,
    aggregateType: "DeskBooking",
    payload: {
      bookingId: row.id,
      memberId: row.memberId,
      deskId: row.deskId,
      bookingType: "DESK",
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
    },
  });

  return withResourceLock(input.deskId, async (tx) => {
    // 冲突校验与插入必须在同一把资源锁内，否则并发下会双卖
    const conflicts = await tx
      .select({
        startTime: deskBookings.startTime,
        endTime: deskBookings.endTime,
        status: deskBookings.status,
      })
      .from(deskBookings)
      .where(eq(deskBookings.deskId, input.deskId))
      .all();
    if (hasOverlapWithExisting(slot, conflicts)) {
      throw new Error("该工位在所选时段已被预订，请更换时间");
    }

    await tx
      .insert(deskBookings)
      .values({
        id: row.id,
        memberId: row.memberId,
        deskId: row.deskId,
        startTime: row.startTime,
        endTime: row.endTime,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
      .run();
    await appendOutboxEvents(tx, [event]);

    return row;
  });
}

export async function cancelDeskBooking(
  bookingId: string,
  memberId: string
): Promise<DeskBooking> {
  const row = await db.select().from(deskBookings).where(eq(deskBookings.id, bookingId)).get();
  const owned = requireOwner<DeskBooking>(row as DeskBooking, memberId);
  const result = deskSM.cancelDeskBooking(owned, new Date());
  if (!result.ok) throw new Error(result.error);
  const next = result.value;

  const event = createEvent({
    eventType: "booking.booking-cancelled",
    aggregateId: next.id,
    aggregateType: "DeskBooking",
    payload: {
      bookingId: next.id,
      memberId: next.memberId,
      deskId: next.deskId,
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(deskBookings)
      .set({ status: next.status, cancelledAt: next.cancelledAt, updatedAt: next.updatedAt })
      .where(eq(deskBookings.id, bookingId))
      .run();
    await appendOutboxEvents(tx, [event]);
  });
  return next;
}

export async function checkInDeskBooking(
  bookingId: string,
  memberId: string
): Promise<DeskBooking> {
  const row = await db.select().from(deskBookings).where(eq(deskBookings.id, bookingId)).get();
  const owned = requireOwner<DeskBooking>(row as DeskBooking, memberId);
  const result = deskSM.checkInDeskBooking(owned, new Date());
  if (!result.ok) throw new Error(result.error);
  const next = result.value;

  const event = createEvent({
    eventType: "booking.booking-checked-in",
    aggregateId: next.id,
    aggregateType: "DeskBooking",
    payload: {
      bookingId: next.id,
      memberId: next.memberId,
      checkInTime: (next.checkedInAt ?? new Date()).toISOString(),
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(deskBookings)
      .set({ status: next.status, checkedInAt: next.checkedInAt, updatedAt: next.updatedAt })
      .where(eq(deskBookings.id, bookingId))
      .run();
    await appendOutboxEvents(tx, [event]);
  });
  return next;
}

export async function checkOutDeskBooking(
  bookingId: string,
  memberId: string
): Promise<DeskBooking> {
  const row = await db.select().from(deskBookings).where(eq(deskBookings.id, bookingId)).get();
  const owned = requireOwner<DeskBooking>(row as DeskBooking, memberId);
  const result = deskSM.checkOutDeskBooking(owned, new Date());
  if (!result.ok) throw new Error(result.error);
  const next = result.value;

  const event = createEvent({
    eventType: "booking.booking-checked-out",
    aggregateId: next.id,
    aggregateType: "DeskBooking",
    payload: {
      bookingId: next.id,
      memberId: next.memberId,
      checkOutTime: (next.checkedOutAt ?? new Date()).toISOString(),
      actualDurationMs: next.checkedOutAt
        ? next.checkedOutAt.getTime() - (next.checkedInAt ?? next.startTime).getTime()
        : 0,
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(deskBookings)
      .set({ status: next.status, checkedOutAt: next.checkedOutAt, updatedAt: next.updatedAt })
      .where(eq(deskBookings.id, bookingId))
      .run();
    await appendOutboxEvents(tx, [event]);
  });
  return next;
}

export type NoShowActor = {
  memberId?: string | null;
  isAdmin: boolean;
};

/** 爽约标记：管理员可直接操作；会员只能标记自己的预订 */
export async function markDeskNoShow(
  bookingId: string,
  actor: NoShowActor
): Promise<DeskBooking> {
  const row = await db.select().from(deskBookings).where(eq(deskBookings.id, bookingId)).get();
  if (!row) throw new Error("记录不存在");
  if (!actor.isAdmin && row.memberId !== actor.memberId) {
    throw new Error("无权操作他人的预订");
  }
  const result = deskSM.markDeskNoShow(row as DeskBooking, new Date());
  if (!result.ok) throw new Error(result.error);
  const next = result.value;

  await db
    .update(deskBookings)
    .set({ status: next.status, updatedAt: next.updatedAt })
    .where(eq(deskBookings.id, bookingId))
    .run();
  return next;
}

// ---------- 逾期巡检（到期自动签退 / 自动爽约） ----------

export type ReconcileResult = {
  /** 本轮自动签退的预订数 */
  checkedOut: number;
  /** 本轮判定为爽约的预订数 */
  noShow: number;
};

/**
 * 巡检逾期预订（幂等，可重复执行）：
 * - CHECKED_IN 且已过「结束 + 宽限期」→ CHECKED_OUT，checkedOutAt 记为 endTime；
 * - CONFIRMED 且已过「开始 + 15 分钟」→ NO_SHOW。
 *
 * 由 `/api/booking/reconcile` 定时驱动；条件 UPDATE 保证与会员手动签退并发时
 * 只有一方生效，不会重复发事件。
 */
export async function reconcileOverdueBookings(
  now = new Date()
): Promise<ReconcileResult> {
  const checkedOut = await autoCheckOutOverdue(now);
  const noShow = await markOverdueNoShows(now);
  return { checkedOut, noShow };
}

async function autoCheckOutOverdue(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - AUTO_CHECK_OUT_GRACE_MS);
  const rows = await db
    .select()
    .from(deskBookings)
    .where(and(eq(deskBookings.status, "CHECKED_IN"), lte(deskBookings.endTime, cutoff)))
    .all();

  let count = 0;
  for (const row of rows) {
    const verdict = deskSM.autoCheckOut(row as DeskBooking, now);
    if (!verdict.ok) continue;
    const next = verdict.value;
    const checkOutTime = next.checkedOutAt ?? next.endTime;
    const event = createEvent({
      eventType: "booking.booking-checked-out",
      aggregateId: next.id,
      aggregateType: "DeskBooking",
      payload: {
        bookingId: next.id,
        memberId: next.memberId,
        checkOutTime: checkOutTime.toISOString(),
        actualDurationMs:
          checkOutTime.getTime() - (next.checkedInAt ?? next.startTime).getTime(),
        auto: true,
      },
    });

    const applied = await db.transaction(async (tx) => {
      const updated = await tx
        .update(deskBookings)
        .set({
          status: next.status,
          checkedOutAt: next.checkedOutAt,
          updatedAt: next.updatedAt,
        })
        .where(and(eq(deskBookings.id, next.id), eq(deskBookings.status, "CHECKED_IN")))
        .returning({ id: deskBookings.id })
        .all();
      if (updated.length === 0) return false; // 已被会员手动签退
      await appendOutboxEvents(tx, [event]);
      return true;
    });
    if (applied) count += 1;
  }
  return count;
}

async function markOverdueNoShows(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - NO_SHOW_GRACE_MS);
  const rows = await db
    .select()
    .from(deskBookings)
    .where(and(eq(deskBookings.status, "CONFIRMED"), lte(deskBookings.startTime, cutoff)))
    .all();

  let count = 0;
  for (const row of rows) {
    const verdict = deskSM.markDeskNoShow(row as DeskBooking, now);
    if (!verdict.ok) continue;
    const updated = await db
      .update(deskBookings)
      .set({ status: "NO_SHOW", updatedAt: verdict.value.updatedAt })
      .where(and(eq(deskBookings.id, row.id), eq(deskBookings.status, "CONFIRMED")))
      .returning({ id: deskBookings.id })
      .all();
    if (updated.length > 0) count += 1;
  }
  return count;
}

export async function listMyDeskBookings(memberId: string): Promise<DeskBooking[]> {
  const rows = await db
    .select()
    .from(deskBookings)
    .where(eq(deskBookings.memberId, memberId))
    .orderBy(desc(deskBookings.startTime))
    .all();
  return rows as unknown as DeskBooking[];
}

// ---------- 会议室预订 ----------

export type CreateRoomBookingInput = {
  memberId: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  expectedAttendees?: number;
};

export async function createRoomBooking(
  input: CreateRoomBookingInput
): Promise<RoomBooking> {
  const slot = asSlot(input.startTime, input.endTime);
  if (slot.isBefore(new Date())) {
    throw new Error("预订开始时间不能早于当前时间");
  }

  // 所有注册会员可预订
  const member = await db.select().from(members).where(eq(members.id, input.memberId)).get();
  if (!member) throw new Error("会员不存在");

  const room = await db.select().from(meetingRooms).where(eq(meetingRooms.id, input.roomId)).get();
  if (!room) throw new Error("会议室不存在");
  if (room.status !== "AVAILABLE") throw new Error("会议室当前不可预订");

  const now = new Date();
  const created: RoomBooking = {
    id: crypto.randomUUID(),
    memberId: input.memberId,
    roomId: input.roomId,
    startTime: input.startTime,
    endTime: input.endTime,
    expectedAttendees: input.expectedAttendees ?? 0,
    status: "PENDING",
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const confirmed = roomSM.confirmRoomBooking(created, now);
  if (!confirmed.ok) throw new Error(confirmed.error);
  const row = confirmed.value;

  const event = createEvent({
    eventType: "booking.booking-confirmed",
    aggregateId: row.id,
    aggregateType: "MeetingRoomBooking",
    payload: {
      bookingId: row.id,
      memberId: row.memberId,
      roomId: row.roomId,
      bookingType: "ROOM",
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
    },
  });

  return withResourceLock(input.roomId, async (tx) => {
    const conflicts = await tx
      .select({
        startTime: roomBookings.startTime,
        endTime: roomBookings.endTime,
        status: roomBookings.status,
      })
      .from(roomBookings)
      .where(eq(roomBookings.roomId, input.roomId))
      .all();
    if (hasOverlapWithExisting(slot, conflicts)) {
      throw new Error("该会议室在所选时段已被预订，请更换时间");
    }

    await tx.insert(roomBookings).values({
      id: row.id,
      memberId: row.memberId,
      roomId: row.roomId,
      startTime: row.startTime,
      endTime: row.endTime,
      expectedAttendees: row.expectedAttendees,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }).run();
    await appendOutboxEvents(tx, [event]);

    return row;
  });
}

export async function startRoomBooking(
  bookingId: string,
  memberId: string
): Promise<RoomBooking> {
  const row = await db.select().from(roomBookings).where(eq(roomBookings.id, bookingId)).get();
  const owned = requireOwner<RoomBooking>(row as RoomBooking, memberId);
  const result = roomSM.startRoomBooking(owned, new Date());
  if (!result.ok) throw new Error(result.error);
  const next = result.value;

  // 开始使用即占用资源 → 发布事件，Billing 按预定时长写入 ROOM_USAGE 消费明细
  const event = createEvent({
    eventType: "booking.room-booking-started",
    aggregateId: next.id,
    aggregateType: "MeetingRoomBooking",
    payload: {
      roomBookingId: next.id,
      memberId: next.memberId,
      roomId: next.roomId,
      bookedStartTime: next.startTime.toISOString(),
      bookedEndTime: next.endTime.toISOString(),
      actualStartTime: (next.startedAt ?? next.startTime).toISOString(),
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(roomBookings)
      .set({ status: next.status, startedAt: next.startedAt, updatedAt: next.updatedAt })
      .where(eq(roomBookings.id, bookingId))
      .run();
    await appendOutboxEvents(tx, [event]);
  });
  return next;
}

export async function completeRoomBooking(
  bookingId: string,
  memberId: string
): Promise<RoomBooking> {
  const row = await db.select().from(roomBookings).where(eq(roomBookings.id, bookingId)).get();
  const owned = requireOwner<RoomBooking>(row as RoomBooking, memberId);
  const result = roomSM.completeRoomBooking(owned, new Date());
  if (!result.ok) throw new Error(result.error);
  const next = result.value;

  const event = createEvent({
    eventType: "booking.room-booking-completed",
    aggregateId: next.id,
    aggregateType: "MeetingRoomBooking",
    payload: {
      roomBookingId: next.id,
      memberId: next.memberId,
      roomId: next.roomId,
      bookedStartTime: next.startTime.toISOString(),
      bookedEndTime: next.endTime.toISOString(),
      actualStartTime: (next.startedAt ?? next.startTime).toISOString(),
      actualEndTime: (next.completedAt ?? next.endTime).toISOString(),
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(roomBookings)
      .set({ status: next.status, completedAt: next.completedAt, updatedAt: next.updatedAt })
      .where(eq(roomBookings.id, bookingId))
      .run();
    await appendOutboxEvents(tx, [event]);
  });
  return next;
}

export async function cancelRoomBooking(
  bookingId: string,
  memberId: string
): Promise<RoomBooking> {
  const row = await db.select().from(roomBookings).where(eq(roomBookings.id, bookingId)).get();
  const owned = requireOwner<RoomBooking>(row as RoomBooking, memberId);
  const result = roomSM.cancelRoomBooking(owned, new Date());
  if (!result.ok) throw new Error(result.error);
  const next = result.value;

  const event = createEvent({
    eventType: "booking.booking-cancelled",
    aggregateId: next.id,
    aggregateType: "MeetingRoomBooking",
    payload: {
      bookingId: next.id,
      memberId: next.memberId,
      roomId: next.roomId,
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(roomBookings)
      .set({ status: next.status, cancelledAt: next.cancelledAt, updatedAt: next.updatedAt })
      .where(eq(roomBookings.id, bookingId))
      .run();
    await appendOutboxEvents(tx, [event]);
  });
  return next;
}

export async function listMyRoomBookings(memberId: string): Promise<RoomBooking[]> {
  const rows = await db
    .select()
    .from(roomBookings)
    .where(eq(roomBookings.memberId, memberId))
    .orderBy(desc(roomBookings.startTime))
    .all();
  return rows as unknown as RoomBooking[];
}

// ---------- 灵活区会话 ----------

export async function startFlexSession(
  memberId: string,
  zoneId: string
): Promise<FlexSession> {
  // 订阅资格：FLEX_DESK
  await assertSubscriptionEligible(memberId, ["FLEX_DESK"]);

  const zone = await db.select().from(flexZones).where(eq(flexZones.id, zoneId)).get();
  if (!zone) throw new Error("灵活区域不存在");
  if (zone.status !== "OPEN") throw new Error("灵活区域当前未开放");

  // 一人同时只能有一个在场会话
  const active = await db
    .select({ id: flexSessions.id })
    .from(flexSessions)
    .where(and(eq(flexSessions.memberId, memberId), eq(flexSessions.status, "ACTIVE")))
    .get();
  if (active) throw new Error("你已有在场会话，请先离场");

  const now = new Date();
  const session: FlexSession = {
    id: crypto.randomUUID(),
    memberId,
    zoneId,
    checkInAt: now,
    checkOutAt: null,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  const event = createEvent({
    eventType: "booking.flex-session-started",
    aggregateId: session.id,
    aggregateType: "FlexSession",
    payload: {
      sessionId: session.id,
      memberId: session.memberId,
      zoneId: session.zoneId,
      checkInTime: session.checkInAt.toISOString(),
    },
  });

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(flexSessions)
        .values({
          id: session.id,
          memberId: session.memberId,
          zoneId: session.zoneId,
          checkInAt: session.checkInAt,
          status: session.status,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        })
        .run();
      await appendOutboxEvents(tx, [event]);
    });
  } catch (error) {
    // 并发下前置查询会同时通过，正确性由 flex_session_active_member_idx 保证
    if (isUniqueViolation(error)) {
      throw new Error("你已有在场会话，请先离场");
    }
    throw error;
  }

  return session;
}

export async function endFlexSession(
  sessionId: string,
  memberId: string
): Promise<FlexSession> {
  const row = await db.select().from(flexSessions).where(eq(flexSessions.id, sessionId)).get();
  const owned = requireOwner<FlexSession>(row as FlexSession, memberId);
  const result = flexSM.endFlexSession(owned, new Date());
  if (!result.ok) throw new Error(result.error);
  const next = result.value;

  const event = createEvent({
    eventType: "booking.flex-session-ended",
    aggregateId: next.id,
    aggregateType: "FlexSession",
    payload: {
      sessionId: next.id,
      memberId: next.memberId,
      zoneId: next.zoneId,
      checkOutTime: (next.checkOutAt ?? new Date()).toISOString(),
      actualDurationMs: next.checkOutAt
        ? next.checkOutAt.getTime() - next.checkInAt.getTime()
        : 0,
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .update(flexSessions)
      .set({ status: next.status, checkOutAt: next.checkOutAt, updatedAt: next.updatedAt })
      .where(eq(flexSessions.id, sessionId))
      .run();
    await appendOutboxEvents(tx, [event]);
  });
  return next;
}

export async function getActiveFlexSession(memberId: string): Promise<FlexSession | null> {
  const row = await db
    .select()
    .from(flexSessions)
    .where(and(eq(flexSessions.memberId, memberId), eq(flexSessions.status, "ACTIVE")))
    .get();
  return (row as FlexSession | null) ?? null;
}

export async function listMyFlexSessions(memberId: string): Promise<FlexSession[]> {
  const rows = await db
    .select()
    .from(flexSessions)
    .where(eq(flexSessions.memberId, memberId))
    .orderBy(desc(flexSessions.checkInAt))
    .all();
  return rows as unknown as FlexSession[];
}

// ---------- 可用性查询 ----------

export async function isDeskSlotAvailable(
  deskId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const slot = asSlot(startTime, endTime);
  const existing = await db
    .select({ startTime: deskBookings.startTime, endTime: deskBookings.endTime, status: deskBookings.status })
    .from(deskBookings)
    .where(eq(deskBookings.deskId, deskId))
    .all();
  return !hasOverlapWithExisting(slot, existing);
}

export async function isRoomSlotAvailable(
  roomId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const slot = asSlot(startTime, endTime);
  const existing = await db
    .select({ startTime: roomBookings.startTime, endTime: roomBookings.endTime, status: roomBookings.status })
    .from(roomBookings)
    .where(eq(roomBookings.roomId, roomId))
    .all();
  return !hasOverlapWithExisting(slot, existing);
}

/** 查找某个时段内可预订的工位 */
export async function findAvailableDesks(
  startTime: Date,
  endTime: Date
): Promise<DeskBooking["deskId"][]> {
  const allDesks = await db.select().from(desks).where(eq(desks.status, "AVAILABLE")).all();
  const available: string[] = [];
  for (const desk of allDesks) {
    if (await isDeskSlotAvailable(desk.id, startTime, endTime)) {
      available.push(desk.id);
    }
  }
  return available;
}

/** 查找某个时段内可预订的会议室 */
export async function findAvailableRooms(
  startTime: Date,
  endTime: Date
): Promise<RoomBooking["roomId"][]> {
  const allRooms = await db.select().from(meetingRooms).where(eq(meetingRooms.status, "AVAILABLE")).all();
  const available: string[] = [];
  for (const room of allRooms) {
    if (await isRoomSlotAvailable(room.id, startTime, endTime)) {
      available.push(room.id);
    }
  }
  return available;
}
