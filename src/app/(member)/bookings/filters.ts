export const BOOKING_TYPE_OPTIONS = [
  { value: "DESK", label: "固定工位", kind: "deskBooking" },
  { value: "ROOM", label: "会议室", kind: "roomBooking" },
  { value: "FLEX", label: "灵活区", kind: "flexSession" },
] as const;

export type BookingType = (typeof BOOKING_TYPE_OPTIONS)[number]["value"];

export const STATUS_GROUPS = [
  { value: "pending", label: "待确认", statuses: ["PENDING"] },
  { value: "confirmed", label: "已确认", statuses: ["CONFIRMED"] },
  {
    value: "ongoing",
    label: "进行中",
    statuses: ["CHECKED_IN", "IN_PROGRESS", "ACTIVE"],
  },
  {
    value: "completed",
    label: "已完成",
    statuses: ["CHECKED_OUT", "COMPLETED"],
  },
  { value: "cancelled", label: "已取消", statuses: ["CANCELLED"] },
  { value: "no_show", label: "未到场", statuses: ["NO_SHOW"] },
] as const;

export type BookingStatusGroup = (typeof STATUS_GROUPS)[number];

const TYPE_STATUSES: Record<BookingType, readonly string[]> = {
  DESK: [
    "PENDING",
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
    "CANCELLED",
    "NO_SHOW",
  ],
  ROOM: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  FLEX: ["ACTIVE", "COMPLETED", "NO_SHOW"],
};

export function isBookingType(value?: string): value is BookingType {
  return BOOKING_TYPE_OPTIONS.some((option) => option.value === value);
}

export function getStatusOptions(
  type?: BookingType
): readonly BookingStatusGroup[] {
  if (!type) return STATUS_GROUPS;

  const allowed = TYPE_STATUSES[type];
  return STATUS_GROUPS.filter((group) =>
    group.statuses.some((status) => allowed.includes(status))
  );
}

export function getStatusLabel(
  group: BookingStatusGroup,
  type?: BookingType
): string {
  if (type === "FLEX") {
    if (group.value === "ongoing") return "在场";
    if (group.value === "completed") return "已离场";
  }
  if (type === "DESK" && group.value === "ongoing") return "使用中";
  return group.label;
}

export function getStatusGroup(
  value: string | undefined,
  type?: BookingType
): BookingStatusGroup | undefined {
  const group = STATUS_GROUPS.find((item) => item.value === value);
  if (!group) return undefined;
  if (!type) return group;

  const allowed = TYPE_STATUSES[type];
  return group.statuses.some((status) => allowed.includes(status))
    ? group
    : undefined;
}

export function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDateParam(
  value: string | undefined,
  endOfDay: boolean
): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}
