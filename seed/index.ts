import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  plans,
  desks,
  meetingRooms,
  flexZones,
  gates,
  members,
  subscriptions,
} from "@/lib/db/schema";
import { buildDeskCode } from "@/modules/facility/domain/desk-code";
import {
  PLAN_SEEDS,
  DESK_SEEDS,
  MEETING_ROOM_SEEDS,
  PRIVATE_OFFICE_SEEDS,
  FLEX_ZONE_SEEDS,
  GATE_SEEDS,
  ADMIN_SEED,
} from "./data";

/** 种子脚本：`npm run db:seed`。已有数据则跳过，除非 DATABASE_SEED_FORCE=1。 */
async function main() {
  const force = process.env.DATABASE_SEED_FORCE === "1";

  const planCount = (await db.select({ id: plans.id }).from(plans).all()).length;
  if (planCount > 0 && !force) {
    console.log("⚠️  数据已存在（plans 表非空），跳过种子。设置 DATABASE_SEED_FORCE=1 可重置。");
    return;
  }

  if (force) {
    // 清空（按依赖顺序：子表 → 父表）
    await db.delete(gates).run();
    await db.delete(flexZones).run();
    await db.delete(meetingRooms).run();
    await db.delete(desks).run();
    await db.delete(subscriptions).run();
    await db.delete(members).run();
    await db.delete(plans).run();
  }

  // 1. 套餐目录
  for (const p of PLAN_SEEDS) {
    await db
      .insert(plans)
      .values({
        name: p.name,
        planType: p.planType,
        monthlyFeeCents: Math.round(p.monthlyFeeYuan * 100),
        freeFlexHours: p.freeFlexHours,
        description: p.description,
        isActive: true,
      })
      .run();
  }
  console.log(`✅ 套餐 ${PLAN_SEEDS.length} 个`);

  // 2. 工位
  for (const d of DESK_SEEDS) {
    const code = buildDeskCode(d.floor, d.zone, Number(d.deskNumber));
    await db
      .insert(desks)
      .values({
        floor: d.floor,
        zone: d.zone,
        deskNumber: d.deskNumber,
        code,
        type: d.type,
        status: "AVAILABLE",
      })
      .run();
  }
  console.log(`✅ 工位 ${DESK_SEEDS.length} 个`);

  // 3. 会议室
  for (const r of MEETING_ROOM_SEEDS) {
    await db
      .insert(meetingRooms)
      .values({
        name: r.name,
        capacity: r.capacity,
        equipments: JSON.stringify(r.equipments),
        hourlyRateCents: Math.round(r.hourlyRateYuan * 100),
        type: "MEETING_ROOM",
        status: "AVAILABLE",
      })
      .run();
  }
  console.log(`✅ 会议室 ${MEETING_ROOM_SEEDS.length} 间`);

  // 3.5 独立办公室（复用 meeting_room 表，type=PRIVATE_OFFICE）
  for (const o of PRIVATE_OFFICE_SEEDS) {
    await db
      .insert(meetingRooms)
      .values({
        name: o.name,
        capacity: o.capacity,
        equipments: JSON.stringify(o.equipments),
        hourlyRateCents: Math.round(o.hourlyRateYuan * 100),
        type: "PRIVATE_OFFICE",
        status: "AVAILABLE",
      })
      .run();
  }
  console.log(`✅ 独立办公室 ${PRIVATE_OFFICE_SEEDS.length} 间`);

  // 4. 灵活区域
  for (const z of FLEX_ZONE_SEEDS) {
    await db
      .insert(flexZones)
      .values({ ...z, status: "OPEN" })
      .run();
  }
  console.log(`✅ 灵活区域 ${FLEX_ZONE_SEEDS.length} 个`);

  // 5. 闸机
  for (const g of GATE_SEEDS) {
    await db.insert(gates).values({ ...g, status: "OPERATIONAL" }).run();
  }
  console.log(`✅ 闸机 ${GATE_SEEDS.length} 台`);

  // 6. 管理员账号（含会员档案）
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_SEED.email))
    .get();
  if (existing && !force) {
    console.log("⚠️  管理员账号已存在，跳过");
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_SEED.password, 10);
    const member = await db
      .insert(members)
      .values({
        name: ADMIN_SEED.name,
        email: ADMIN_SEED.email,
        phone: "13800000000",
        tier: ADMIN_SEED.tier,
        creditScore: 100,
      })
      .returning({ id: members.id })
      .get();
    const user = await db
      .insert(users)
      .values({
        name: ADMIN_SEED.name,
        email: ADMIN_SEED.email,
        passwordHash,
        role: "ADMIN",
        memberId: member.id,
      })
      .returning({ id: users.id })
      .get();
    console.log(`✅ 管理员账号：${ADMIN_SEED.email} / ${ADMIN_SEED.password} (user=${user.id})`);
  }

  console.log("🎉 种子数据完成");
}

main()
  .catch((e) => {
    console.error("❌ 种子失败:", e);
    process.exit(1);
  });
