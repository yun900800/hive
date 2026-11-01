"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminGuardError } from "@/lib/auth-guards";
import {
  createDesk,
  updateDesk,
  deleteDesk,
  createMeetingRoom,
  updateMeetingRoom,
  deleteMeetingRoom,
  createFlexZone,
  deleteFlexZone,
  createGate,
  deleteGate,
} from "@/modules/facility/application/facility-app";

export type ActionState = { error?: string };

/** 管理端守卫：非管理员直接返回错误，不落库 */
async function guardAdmin(): Promise<string | null> {
  return adminGuardError();
}

const deskSchema = z.object({
  floor: z.string().trim().regex(/^[A-Za-z]$/, "楼层需为单个字母，如 B"),
  zone: z.string().trim().regex(/^\d+$/, "分区需为数字，如 1"),
  deskNumber: z.string().trim().regex(/^\d+$/, "工位号需为数字，如 2"),
  type: z.enum(["STANDARD", "WINDOW_SIDE", "QUIET_ZONE", "STANDING"]),
});

export async function createDeskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const parsed = deskSchema.safeParse({
    floor: formData.get("floor"),
    zone: formData.get("zone"),
    deskNumber: formData.get("deskNumber"),
    type: formData.get("type"),
  });
  if (!parsed.success) return { error: "工位信息不合法" };

  try {
    await createDesk(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "创建失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

export async function updateDeskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const id = String(formData.get("id") ?? "");
  const parsed = deskSchema.safeParse({
    floor: formData.get("floor"),
    zone: formData.get("zone"),
    deskNumber: formData.get("deskNumber"),
    type: formData.get("type"),
  });
  if (!id || !parsed.success) return { error: "工位信息不合法" };

  try {
    await updateDesk(id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

export async function deleteDeskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const id = String(formData.get("id") ?? "");
  try {
    await deleteDesk(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "删除失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

const roomSchema = z.object({
  name: z.string().trim().min(1).max(50),
  capacity: z.coerce.number().int().min(1).max(500),
  hourlyRateYuan: z.coerce.number().positive(),
  type: z.enum(["MEETING_ROOM", "PRIVATE_OFFICE"]).default("MEETING_ROOM"),
});

export async function createMeetingRoomAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    capacity: formData.get("capacity"),
    hourlyRateYuan: formData.get("hourlyRate"),
    type: formData.get("type") ?? "MEETING_ROOM",
  });
  if (!parsed.success) return { error: "会议室信息不合法" };

  try {
    await createMeetingRoom({
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      hourlyRateCents: Math.round(parsed.data.hourlyRateYuan * 100),
      equipments: ["投影", "白板"],
      type: parsed.data.type,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "创建失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

export async function updateMeetingRoomAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const id = String(formData.get("id") ?? "");
  const parsed = roomSchema.safeParse({
    name: formData.get("name"),
    capacity: formData.get("capacity"),
    hourlyRateYuan: formData.get("hourlyRate"),
    type: formData.get("type") ?? "MEETING_ROOM",
  });
  if (!id || !parsed.success) return { error: "会议室信息不合法" };

  try {
    await updateMeetingRoom(id, {
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      hourlyRateCents: Math.round(parsed.data.hourlyRateYuan * 100),
      type: parsed.data.type,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

export async function deleteMeetingRoomAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const id = String(formData.get("id") ?? "");
  try {
    await deleteMeetingRoom(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "删除失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const flexZoneSchema = z
  .object({
    name: z.string().trim().min(1, "请填写区域名称").max(50),
    floor: z.string().trim().regex(/^[A-Za-z]$/, "楼层需为单个字母，如 A"),
    capacity: z.coerce.number().int().min(1, "容量至少 1 人").max(500),
    openingTime: z.string().regex(TIME_PATTERN, "开放时间格式应为 HH:MM"),
    closingTime: z.string().regex(TIME_PATTERN, "关闭时间格式应为 HH:MM"),
  })
  .refine((value) => value.openingTime < value.closingTime, {
    message: "关闭时间需晚于开放时间",
    path: ["closingTime"],
  });

export async function createFlexZoneAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const parsed = flexZoneSchema.safeParse({
    name: formData.get("name"),
    floor: formData.get("floor"),
    capacity: formData.get("capacity"),
    openingTime: formData.get("openingTime"),
    closingTime: formData.get("closingTime"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "灵活区信息不合法" };
  }

  try {
    await createFlexZone(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "创建失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

export async function deleteFlexZoneAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const id = String(formData.get("id") ?? "");
  try {
    await deleteFlexZone(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "删除失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

const gateSchema = z.object({
  name: z.string().trim().min(1, "请填写闸机名称").max(50),
  floor: z.string().trim().regex(/^[A-Za-z]$/, "楼层需为单个字母，如 A"),
  zone: z.string().trim().min(1, "请填写区域").max(20),
  type: z.enum([
    "ENTRY_TURNSTILE",
    "EXIT_TURNSTILE",
    "EMERGENCY_EXIT",
    "ELEVATOR_CONTROL",
  ]),
});

export async function createGateAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const parsed = gateSchema.safeParse({
    name: formData.get("name"),
    floor: formData.get("floor"),
    zone: formData.get("zone"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "闸机信息不合法" };
  }

  try {
    await createGate(parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "创建失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}

export async function deleteGateAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const authError = await guardAdmin();
  if (authError) return { error: authError };

  const id = String(formData.get("id") ?? "");
  try {
    await deleteGate(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "删除失败" };
  }
  revalidatePath("/admin/facility");
  return {};
}
