import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { desks, meetingRooms, flexZones, gates, flexSessions } from "@/lib/db/schema";
import { buildDeskCode, parseDeskCode } from "../domain/desk-code";
import type { DeskStatus, RoomStatus, RoomType, DeskType } from "../domain/types";

/**
 * FacilityApplicationService — 空间资源（工位/会议室/灵活区/闸机）管理用例。
 */

// ---------- 工位 ----------

export type CreateDeskInput = {
  floor: string; // "B"
  zone: string; // "1"
  deskNumber: string; // "2"
  type: DeskType;
};

export async function createDesk(input: CreateDeskInput) {
  const code = buildDeskCode(input.floor, input.zone, Number(input.deskNumber));
  return db
    .insert(desks)
    .values({
      floor: input.floor,
      zone: input.zone,
      deskNumber: input.deskNumber,
      code,
      type: input.type,
      status: "AVAILABLE",
    })
    .returning()
    .get();
}

export type UpdateDeskInput = {
  floor?: string;
  zone?: string;
  deskNumber?: string;
  type?: DeskType;
  status?: DeskStatus;
};

export async function updateDesk(id: string, input: UpdateDeskInput) {
  const patch: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.floor != null && input.zone != null && input.deskNumber != null) {
    patch.code = buildDeskCode(input.floor, input.zone, Number(input.deskNumber));
  }
  return db
    .update(desks)
    .set(patch)
    .where(eq(desks.id, id))
    .returning()
    .get();
}

export async function deleteDesk(id: string) {
  return db.delete(desks).where(eq(desks.id, id)).run();
}

export async function listDesks() {
  return db.select().from(desks).all();
}

export async function findDeskByCode(code: string) {
  const parsed = parseDeskCode(code);
  if (!parsed) return null;
  return db
    .select()
    .from(desks)
    .where(
      eq(desks.code, code)
    )
    .get();
}

// ---------- 会议室 ----------

export type CreateMeetingRoomInput = {
  name: string;
  capacity: number;
  equipments: string[];
  hourlyRateCents: number;
  type?: RoomType;
};

export async function createMeetingRoom(input: CreateMeetingRoomInput) {
  return db
    .insert(meetingRooms)
    .values({
      name: input.name,
      capacity: input.capacity,
      equipments: JSON.stringify(input.equipments),
      hourlyRateCents: input.hourlyRateCents,
      type: input.type ?? "MEETING_ROOM",
      status: "AVAILABLE",
    })
    .returning()
    .get();
}

export type UpdateMeetingRoomInput = {
  name?: string;
  capacity?: number;
  equipments?: string[];
  hourlyRateCents?: number;
  type?: RoomType;
  status?: RoomStatus;
};

export async function updateMeetingRoom(id: string, input: UpdateMeetingRoomInput) {
  const patch: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.equipments) patch.equipments = JSON.stringify(input.equipments);
  return db
    .update(meetingRooms)
    .set(patch)
    .where(eq(meetingRooms.id, id))
    .returning()
    .get();
}

export async function deleteMeetingRoom(id: string) {
  return db.delete(meetingRooms).where(eq(meetingRooms.id, id)).run();
}

export async function listMeetingRooms() {
  const rows = await db.select().from(meetingRooms).all();
  return rows.map((r) => ({
    ...r,
    equipments: parseEquipments(r.equipments),
  }));
}

// ---------- 灵活区 ----------

export type CreateFlexZoneInput = {
  name: string;
  floor: string;
  capacity: number;
  openingTime: string;
  closingTime: string;
};

export async function createFlexZone(input: CreateFlexZoneInput) {
  return db
    .insert(flexZones)
    .values({
      name: input.name,
      floor: input.floor,
      capacity: input.capacity,
      openingTime: input.openingTime,
      closingTime: input.closingTime,
      status: "OPEN",
    })
    .returning()
    .get();
}

export async function listFlexZones() {
  return db.select().from(flexZones).all();
}

/** 该区域是否有会员正在使用（跨聚合校验，供删除前检查） */
export async function hasActiveFlexSession(zoneId: string): Promise<boolean> {
  const row = await db
    .select({ id: flexSessions.id })
    .from(flexSessions)
    .where(and(eq(flexSessions.zoneId, zoneId), eq(flexSessions.status, "ACTIVE")))
    .get();
  return Boolean(row);
}

export async function deleteFlexZone(id: string) {
  if (await hasActiveFlexSession(id)) {
    throw new Error("该灵活区还有会员在使用，请先办理离场");
  }
  return db.delete(flexZones).where(eq(flexZones.id, id)).run();
}

// ---------- 闸机（本期只读展示） ----------

export async function listGates() {
  return db.select().from(gates).all();
}

function parseEquipments(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
