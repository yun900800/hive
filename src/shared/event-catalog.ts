/**
 * 事件目录 —— 所有领域事件的唯一清单。
 *
 * 存在的理由：分发器必须区分两种情况，否则会重演「事件永久滞留」故障：
 *  1. 该事件当前确实没有订阅者（noSubscriber）→ 直接 SKIPPED，不再占用批次；
 *  2. 该事件应该有订阅者，但本进程没注册（漏了 bootstrap import）
 *     → 保留 PENDING 并延迟重试 + 告警，而不是静默丢弃。
 *
 * 新增事件时：先在 CATALOG 登记，再在对应模块 registerEventHandler。
 * `event-catalog.test.ts` 会断言代码中出现的所有事件类型都已登记。
 */

export type EventSpec = {
  /** true = 当前阶段确实无人消费，分发器标记 SKIPPED */
  noSubscriber?: boolean;
  /** 负责注册订阅者的模块，用于排查遗漏 */
  owners: string[];
};

const CATALOG = {
  "booking.booking-confirmed": { owners: ["access", "notification"] },
  "booking.booking-cancelled": { owners: ["access"] },
  "booking.booking-checked-in": { noSubscriber: true, owners: [] },
  "booking.booking-checked-out": { owners: ["billing"] },
  "booking.room-booking-started": { owners: ["billing"] },
  "booking.room-booking-completed": { owners: ["billing"] },
  "booking.flex-session-started": { owners: ["access"] },
  "booking.flex-session-ended": { owners: ["access", "billing"] },
  "membership.member-registered": { noSubscriber: true, owners: [] },
  "membership.subscription-changed": { owners: ["billing"] },
  "membership.subscription-upgraded": { owners: ["billing"] },
  "membership.subscription-downgraded": { owners: ["billing"] },
  "membership.subscription-cancelled": { noSubscriber: true, owners: [] },
  "access.gate-pass-created": { noSubscriber: true, owners: [] },
  "billing.invoice-issued": { owners: ["notification"] },
} as const satisfies Record<string, EventSpec>;

export type EventType = keyof typeof CATALOG;

export const KNOWN_EVENT_TYPES = Object.keys(CATALOG) as EventType[];

/** 返回事件规格；未登记的返回 undefined（分发器会按配置错误处理） */
export function getEventSpec(eventType: string): EventSpec | undefined {
  return CATALOG[eventType as EventType];
}

/** 该事件类型是否明确声明为「当前无人订阅」 */
export function isNoSubscriberEvent(eventType: string): boolean {
  return getEventSpec(eventType)?.noSubscriber === true;
}
