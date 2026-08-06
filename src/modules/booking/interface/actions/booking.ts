"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionMemberId } from "@/lib/auth-guards";
import * as booking from "@/modules/booking/application/booking-app";
import { dispatchOutboxEvents } from "@/shared/outbox";
// 注册事件订阅者（Access 发通行证 / Notification 发通知 / Billing 记账）
import "@/modules/billing/application/bootstrap";
import "@/modules/notification/application/bootstrap";

export type ActionState = { error?: string };

const slotSchema = z.object({
  resourceId: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
});

// ---------- 工位预订 ----------

export async function createDeskBookingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录会员账号" };

  const parsed = slotSchema.safeParse({
    resourceId: formData.get("deskId"),
    start: formData.get("start"),
    end: formData.get("end"),
  });
  if (!parsed.success) return { error: "请选择工位并填写完整时段" };

  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  if (end.getTime() <= start.getTime()) return { error: "结束时间需晚于开始时间" };

  try {
    await booking.createDeskBooking({
      memberId,
      deskId: parsed.data.resourceId,
      startTime: start,
      endTime: end,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "预订失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  revalidatePath("/bookings/desk");
  return {};
}

export async function cancelDeskBookingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  try {
    await booking.cancelDeskBooking(id, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "取消失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  return {};
}

export async function checkInDeskBookingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  try {
    await booking.checkInDeskBooking(id, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "签到失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  return {};
}

export async function checkOutDeskBookingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  try {
    await booking.checkOutDeskBooking(id, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "签退失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  return {};
}

export async function markDeskNoShowAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  try {
    await booking.markDeskNoShow(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  return {};
}

// ---------- 会议室预订 ----------

export async function createRoomBookingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录会员账号" };

  const parsed = slotSchema.safeParse({
    resourceId: formData.get("roomId"),
    start: formData.get("start"),
    end: formData.get("end"),
  });
  if (!parsed.success) return { error: "请选择会议室并填写完整时段" };

  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  if (end.getTime() <= start.getTime()) return { error: "结束时间需晚于开始时间" };

  const attendees = Number(formData.get("attendees") ?? 0);

  try {
    await booking.createRoomBooking({
      memberId,
      roomId: parsed.data.resourceId,
      startTime: start,
      endTime: end,
      expectedAttendees: Number.isFinite(attendees) && attendees > 0 ? attendees : 0,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "预订失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  revalidatePath("/bookings/room");
  return {};
}

export async function startRoomBookingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  try {
    await booking.startRoomBooking(id, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  return {};
}

export async function completeRoomBookingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  try {
    await booking.completeRoomBooking(id, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "操作失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  return {};
}

export async function cancelRoomBookingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  try {
    await booking.cancelRoomBooking(id, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "取消失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/bookings");
  return {};
}

// ---------- 灵活区 ----------

export async function startFlexSessionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录会员账号" };

  const zoneId = String(formData.get("zoneId") ?? "");
  if (!zoneId) return { error: "请选择灵活区域" };

  try {
    await booking.startFlexSession(memberId, zoneId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "入场失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/flex");
  return {};
}

export async function endFlexSessionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = await getSessionMemberId();
  if (!memberId) return { error: "请先登录" };
  const id = String(formData.get("id") ?? "");
  try {
    await booking.endFlexSession(id, memberId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "离场失败" };
  }
  await dispatchOutboxEvents();
  revalidatePath("/flex");
  revalidatePath("/bookings");
  return {};
}
