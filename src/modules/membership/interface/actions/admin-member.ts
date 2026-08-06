"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-guards";

export type RoleState = { error?: string; success?: string };

/**
 * 管理员：调整某会员关联登录账号的角色（MEMBER | ADMIN）。
 * - 守卫：必须是 ADMIN 才能调用
 * - 防止取消最后一个管理员（避免系统失去管理入口）
 */
export async function setMemberRoleAction(
  _prev: RoleState,
  formData: FormData
): Promise<RoleState> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "无权访问" };
  }

  const memberId = String(formData.get("memberId") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  if (!memberId || (roleRaw !== "MEMBER" && roleRaw !== "ADMIN")) {
    return { error: "参数错误" };
  }
  const role: "MEMBER" | "ADMIN" = roleRaw;

  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.memberId, memberId))
      .get();
    if (!user) return { error: "该会员无关联登录账号" };

    // 防止取消最后一个管理员
    if (role !== "ADMIN" && user.role === "ADMIN") {
      const adminCount = (
        await db.select().from(users).all()
      ).filter((u) => u.role === "ADMIN").length;
      if (adminCount <= 1) {
        return { error: "至少保留一名管理员，无法取消最后的管理员" };
      }
    }

    if (user.role === role) {
      return { success: `角色未变化（当前已是 ${role}）` };
    }

    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .run();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "更新失败" };
  }

  revalidatePath("/admin/members");
  return { success: `已设为 ${role === "ADMIN" ? "管理员" : "普通会员"}` };
}
