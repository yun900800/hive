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
  });
  if (!parsed.success) return { error: "会议室信息不合法" };

  try {
    await createMeetingRoom({
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      hourlyRateCents: Math.round(parsed.data.hourlyRateYuan * 100),
      equipments: ["投影", "白板"],
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
  });
  if (!id || !parsed.success) return { error: "会议室信息不合法" };

  try {
    await updateMeetingRoom(id, {
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      hourlyRateCents: Math.round(parsed.data.hourlyRateYuan * 100),
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
