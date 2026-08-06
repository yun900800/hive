/**
 * Seed data constants — 来自 pricing-scenarios-analysis.md 的定价与示例资源。
 */

import type { PlanType, MemberTier } from "@/modules/membership/domain/types";
import type { DeskType, GateType } from "@/modules/facility/domain/types";

/** 四种套餐（定价来自 design/pricing-scenarios-analysis.md） */
export const PLAN_SEEDS: Array<{
  name: string;
  planType: PlanType;
  monthlyFeeYuan: number;
  freeFlexHours: number;
  description: string;
}> = [
  {
    name: "灵活办公位",
    planType: "FLEX_DESK",
    monthlyFeeYuan: 499,
    freeFlexHours: 40,
    description: "灵活区不限时段入场，含每月 40 小时免费使用额度",
  },
  {
    name: "固定办公位",
    planType: "FIXED_DESK",
    monthlyFeeYuan: 899,
    freeFlexHours: 0,
    description: "专属固定工位 7×24 可用，会议室按小时计费",
  },
  {
    name: "独立办公室",
    planType: "PRIVATE_OFFICE",
    monthlyFeeYuan: 3999,
    freeFlexHours: 0,
    description: "独立办公室 + 基础座位数，适合 3-10 人小团队",
  },
  {
    name: "虚拟会员",
    planType: "VIRTUAL",
    monthlyFeeYuan: 199,
    freeFlexHours: 0,
    description: "地址挂靠 + 收件服务，灵活区/会议室按次付费",
  },
];

/** 示例工位：靠窗工位 B-12（场景中的主角工位） */
export const DESK_SEEDS: Array<{
  floor: string;
  zone: string;
  deskNumber: string;
  type: DeskType;
}> = [
  { floor: "B", zone: "1", deskNumber: "2", type: "WINDOW_SIDE" }, // B-12
  { floor: "A", zone: "1", deskNumber: "8", type: "WINDOW_SIDE" }, // A-18
  { floor: "B", zone: "2", deskNumber: "5", type: "STANDARD" }, // B-25
  { floor: "C", zone: "1", deskNumber: "8", type: "QUIET_ZONE" }, // C-18
  { floor: "B", zone: "3", deskNumber: "1", type: "STANDING" }, // B-31
];

/** 示例会议室 */
export const MEETING_ROOM_SEEDS: Array<{
  name: string;
  capacity: number;
  equipments: string[];
  hourlyRateYuan: number;
}> = [
  { name: "华山厅", capacity: 4, equipments: ["投影仪", "白板"], hourlyRateYuan: 30 },
  { name: "泰山厅", capacity: 8, equipments: ["投影仪", "电视", "白板"], hourlyRateYuan: 60 },
  { name: "黄山厅", capacity: 20, equipments: ["投影仪", "电视", "白板", "音视频"], hourlyRateYuan: 100 },
];

/** 示例灵活区域 */
export const FLEX_ZONE_SEEDS: Array<{
  name: string;
  floor: string;
  capacity: number;
  openingTime: string;
  closingTime: string;
}> = [
  { name: "A区灵活办公区", floor: "A", capacity: 30, openingTime: "08:00", closingTime: "22:00" },
  { name: "B区灵活办公区", floor: "B", capacity: 40, openingTime: "08:00", closingTime: "22:00" },
];

/** 示例闸机 */
export const GATE_SEEDS: Array<{
  name: string;
  floor: string;
  zone: string;
  type: GateType;
}> = [
  { name: "东区入口1号闸机", floor: "A", zone: "entrance", type: "ENTRY_TURNSTILE" },
  { name: "东区出口1号闸机", floor: "A", zone: "exit", type: "EXIT_TURNSTILE" },
  { name: "B区入口闸机", floor: "B", zone: "entrance", type: "ENTRY_TURNSTILE" },
];

/** 默认管理员账号 */
export const ADMIN_SEED = {
  email: "admin@hive.com",
  password: "admin123",
  name: "系统管理员",
  tier: "PLATINUM" as MemberTier,
};
