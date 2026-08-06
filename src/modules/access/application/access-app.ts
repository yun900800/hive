import { eq, and, desc, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { gatePasses, accessLogs } from "@/lib/db/schema";
import { createEvent } from "@/shared/events";
import { appendOutboxEvents } from "@/shared/outbox";
import {
  canGrantAccess,
  markPassUsed,
  revokePass,
  isExpired,
  generatePassCode,
} from "../domain/gate-pass";
import type { GatePass, AccessLogEntry, AccessDirection, AccessResult } from "../domain/types";

/**
 * AccessApplicationService — 通行证与通行日志编排。
 * 预订确认自动发证；扫码（模拟）校验并记录日志。
 */

export type CreateGatePassInput = {
  memberId: string;
  bookingId: string;
  gatePassType: "DESK" | "ROOM" | "FLEX";
  validFrom: Date;
  validTo: Date;
};

/** 预订确认后自动生成通行证 */
export async function createGatePass(
  input: CreateGatePassInput
): Promise<GatePass> {
  const now = new Date();
  const pass: GatePass = {
    id: crypto.randomUUID(),
    code: generatePassCode(input.bookingId),
    memberId: input.memberId,
    bookingId: input.bookingId,
    gatePassType: input.gatePassType,
    validFrom: input.validFrom,
    validTo: input.validTo,
    status: "ACTIVE",
    createdAt: now,
  };

  const event = createEvent({
    eventType: "access.gate-pass-created",
    aggregateId: pass.id,
    aggregateType: "GatePass",
    payload: {
      gatePassId: pass.id,
      memberId: pass.memberId,
      bookingId: pass.bookingId,
      validFrom: pass.validFrom.toISOString(),
      validTo: pass.validTo.toISOString(),
    },
  });

  await db.transaction(async (tx) => {
    await tx
      .insert(gatePasses)
      .values({
        id: pass.id,
        code: pass.code,
        memberId: pass.memberId,
        bookingId: pass.bookingId,
        gatePassType: pass.gatePassType,
        validFrom: pass.validFrom,
        validTo: pass.validTo,
        status: pass.status,
        createdAt: pass.createdAt,
      })
      .run();
    await appendOutboxEvents(tx, [event]);
  });

  return pass;
}

/** 预订取消 / 灵活区离场 → 撤销通行证（幂等；USED 通行证同样撤销） */
export async function revokeGatePassByBooking(bookingId: string): Promise<void> {
  const pass = await db.select().from(gatePasses).where(eq(gatePasses.bookingId, bookingId)).get();
  if (!pass) return;
  if (pass.status === "REVOKED") return;
  const revoked = revokePass(pass as GatePass);
  await db
    .update(gatePasses)
    .set({ status: revoked.status })
    .where(eq(gatePasses.id, pass.id))
    .run();
}

/** 标记过期通行证（批量；可由调度触发） */
export async function expireOldPasses(now = new Date()): Promise<number> {
  const rows = await db
    .select()
    .from(gatePasses)
    .where(and(eq(gatePasses.status, "ACTIVE"), lte(gatePasses.validTo, now)))
    .all();
  for (const row of rows) {
    if (isExpired(row as GatePass, now)) {
      await db.update(gatePasses).set({ status: "EXPIRED" }).where(eq(gatePasses.id, row.id)).run();
    }
  }
  return rows.length;
}

// ---------- 模拟扫码 ----------

type ScanInput = { passCode: string; gateName: string; direction: AccessDirection };

/** 模拟扫码进入/离开：校验通行证 → 写通行日志 */
export async function scan(passCode: string, gateName: string, direction: AccessDirection) {
  const pass = await db.select().from(gatePasses).where(eq(gatePasses.code, passCode)).get();
  if (!pass) {
    await appendLog({ gatePassId: "", memberId: "", gateName, direction, result: "DENIED_INVALID", accessTime: new Date() });
    return { granted: false, result: "DENIED_INVALID" as AccessResult };
  }

  const now = new Date();
  const verdict = canGrantAccess(pass as GatePass, now);
  await appendLog({
    gatePassId: pass.id,
    memberId: pass.memberId,
    gateName,
    direction,
    result: verdict.result,
    accessTime: now,
  });

  if (verdict.granted && direction === "ENTRY") {
    const used = markPassUsed(pass as GatePass);
    await db.update(gatePasses).set({ status: used.status }).where(eq(gatePasses.id, pass.id)).run();
  }

  return { granted: verdict.granted, result: verdict.result, gatePass: pass as GatePass };
}

async function appendLog(params: {
  gatePassId: string;
  memberId: string;
  gateName: string;
  direction: AccessDirection;
  result: AccessResult;
  accessTime: Date;
}): Promise<void> {
  await db
    .insert(accessLogs)
    .values({ ...params })
    .run();
}

// ---------- 查询 ----------

export async function listMyGatePasses(memberId: string): Promise<GatePass[]> {
  const rows = await db
    .select()
    .from(gatePasses)
    .where(eq(gatePasses.memberId, memberId))
    .orderBy(desc(gatePasses.validFrom))
    .all();
  return rows as unknown as GatePass[];
}

export async function listMyAccessLogs(memberId: string): Promise<AccessLogEntry[]> {
  const rows = await db
    .select()
    .from(accessLogs)
    .where(eq(accessLogs.memberId, memberId))
    .orderBy(desc(accessLogs.accessTime))
    .limit(50)
    .all();
  return rows as unknown as AccessLogEntry[];
}

/** 最近通行记录（管理端） */
export async function listRecentAccessLogs(limit = 100): Promise<AccessLogEntry[]> {
  const rows = await db.select().from(accessLogs).orderBy(desc(accessLogs.accessTime)).limit(limit).all();
  return rows as unknown as AccessLogEntry[];
}
