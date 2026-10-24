/**
 * 展示层枚举映射：把领域里的英文枚举翻译成中文与语义色。
 * 纯 UI 关注点，放在 lib 而不是 domain，避免污染领域模型。
 */

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "brand";

export type LabelKind =
  | "deskBooking"
  | "roomBooking"
  | "flexSession"
  | "invoice"
  | "gatePass"
  | "accessResult"
  | "direction"
  | "deskType"
  | "roomType"
  | "planType"
  | "tier"
  | "subscription"
  | "charge"
  | "deskStatus"
  | "roomStatus"
  | "zoneStatus"
  | "gateStatus"
  | "role";

type Meta = { label: string; tone: StatusTone };

const NEUTRAL: Meta = { label: "—", tone: "neutral" };

const MAPS: Record<LabelKind, Record<string, Meta>> = {
  deskBooking: {
    PENDING: { label: "待确认", tone: "warning" },
    CONFIRMED: { label: "已确认", tone: "success" },
    CHECKED_IN: { label: "使用中", tone: "info" },
    CHECKED_OUT: { label: "已完成", tone: "neutral" },
    CANCELLED: { label: "已取消", tone: "neutral" },
    NO_SHOW: { label: "未到场", tone: "danger" },
  },
  roomBooking: {
    PENDING: { label: "待确认", tone: "warning" },
    CONFIRMED: { label: "已确认", tone: "success" },
    IN_PROGRESS: { label: "进行中", tone: "info" },
    COMPLETED: { label: "已完成", tone: "neutral" },
    CANCELLED: { label: "已取消", tone: "neutral" },
  },
  flexSession: {
    ACTIVE: { label: "在场", tone: "info" },
    COMPLETED: { label: "已离场", tone: "neutral" },
    NO_SHOW: { label: "未到场", tone: "danger" },
  },
  invoice: {
    PENDING: { label: "待支付", tone: "warning" },
    PAID: { label: "已支付", tone: "success" },
    OVERDUE: { label: "已逾期", tone: "danger" },
    CANCELLED: { label: "已取消", tone: "neutral" },
  },
  gatePass: {
    ACTIVE: { label: "有效", tone: "success" },
    USED: { label: "已使用", tone: "neutral" },
    EXPIRED: { label: "已过期", tone: "warning" },
    REVOKED: { label: "已撤销", tone: "danger" },
  },
  accessResult: {
    GRANTED: { label: "已放行", tone: "success" },
    DENIED_EXPIRED: { label: "拒绝 · 已过期", tone: "danger" },
    DENIED_NO_BOOKING: { label: "拒绝 · 无有效通行证", tone: "danger" },
    DENIED_REVOKED: { label: "拒绝 · 已撤销", tone: "danger" },
    DENIED_INVALID: { label: "拒绝 · 无效编码", tone: "danger" },
  },
  direction: {
    ENTRY: { label: "入场", tone: "info" },
    EXIT: { label: "离场", tone: "neutral" },
  },
  deskType: {
    STANDARD: { label: "标准位", tone: "neutral" },
    WINDOW_SIDE: { label: "靠窗位", tone: "info" },
    QUIET_ZONE: { label: "静区", tone: "brand" },
    STANDING: { label: "站立位", tone: "neutral" },
  },
  roomType: {
    MEETING_ROOM: { label: "会议室", tone: "neutral" },
    PRIVATE_OFFICE: { label: "独立办公室", tone: "brand" },
  },
  planType: {
    FLEX_DESK: { label: "灵活办公位", tone: "info" },
    FIXED_DESK: { label: "固定办公位", tone: "brand" },
    PRIVATE_OFFICE: { label: "独立办公室", tone: "success" },
    VIRTUAL: { label: "虚拟会员", tone: "neutral" },
  },
  tier: {
    BASIC: { label: "基础会员", tone: "neutral" },
    SILVER: { label: "白银会员", tone: "info" },
    GOLD: { label: "黄金会员", tone: "warning" },
    PLATINUM: { label: "铂金会员", tone: "brand" },
  },
  subscription: {
    ACTIVE: { label: "生效中", tone: "success" },
    CANCELLED: { label: "已取消", tone: "neutral" },
    EXPIRED: { label: "已过期", tone: "warning" },
    SUSPENDED: { label: "已暂停", tone: "danger" },
  },
  charge: {
    MEMBERSHIP_FEE: { label: "会员月费", tone: "brand" },
    DESK_USAGE: { label: "工位使用费", tone: "neutral" },
    FLEX_USAGE: { label: "灵活区使用费", tone: "info" },
    ROOM_USAGE: { label: "会议室使用费", tone: "info" },
    OVER_TIME_PENALTY: { label: "会议室超时费", tone: "warning" },
  },
  deskStatus: {
    AVAILABLE: { label: "可预订", tone: "success" },
    OCCUPIED: { label: "使用中", tone: "info" },
    RESERVED: { label: "已预留", tone: "warning" },
    UNDER_MAINTENANCE: { label: "维护中", tone: "neutral" },
  },
  roomStatus: {
    AVAILABLE: { label: "可预订", tone: "success" },
    IN_USE: { label: "使用中", tone: "info" },
    UNDER_MAINTENANCE: { label: "维护中", tone: "neutral" },
  },
  zoneStatus: {
    OPEN: { label: "开放", tone: "success" },
    CLOSED: { label: "关闭", tone: "neutral" },
    UNDER_MAINTENANCE: { label: "维护中", tone: "warning" },
  },
  gateStatus: {
    OPERATIONAL: { label: "运行正常", tone: "success" },
    UNDER_MAINTENANCE: { label: "维护中", tone: "warning" },
    OFFLINE: { label: "离线", tone: "danger" },
    OUT_OF_SERVICE: { label: "停用", tone: "neutral" },
  },
  role: {
    ADMIN: { label: "管理员", tone: "brand" },
    MEMBER: { label: "普通会员", tone: "neutral" },
  },
};

export function getStatusMeta(kind: LabelKind, value?: string | null): Meta {
  if (!value) return NEUTRAL;
  return MAPS[kind][value] ?? { label: value, tone: "neutral" };
}

export function labelOf(kind: LabelKind, value?: string | null): string {
  return getStatusMeta(kind, value).label;
}
