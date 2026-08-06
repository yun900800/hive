/**
 * Domain event base type + factory.
 * Events flow between bounded contexts through the outbox (at-least-once).
 */

export type DomainEvent<T extends Record<string, unknown> = Record<string, unknown>> = {
  /** 事件唯一 ID */
  eventId: string;
  /** 事件类型，如 "booking.booking-confirmed" */
  eventType: string;
  /** 聚合 ID */
  aggregateId: string;
  /** 聚合类型，如 "DeskBooking" */
  aggregateType: string;
  /** 事件负载（JSON 可序列化） */
  payload: T;
  /** 发生时间 */
  occurredAt: Date;
};

type EventInput<T extends Record<string, unknown>> = Omit<DomainEvent<T>, "eventId" | "occurredAt">;

/** 创建领域事件（时间戳与 ID 自动填充） */
export function createEvent<T extends Record<string, unknown>>(
  input: EventInput<T>
): DomainEvent<T> {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: new Date(),
    ...input,
  };
}

/** 事件注册表：eventType -> handlers[]。由各上下文的订阅者在启动时注册（多订阅者共享同一事件类型）。 */
export type OutboxEventHandler<P extends Record<string, unknown> = Record<string, unknown>> = (
  payload: P,
  meta: { aggregateId: string; aggregateType: string; eventId: string }
) => Promise<void>;

const handlers = new Map<string, OutboxEventHandler[]>();

export function registerEventHandler(
  eventType: string,
  handler: OutboxEventHandler
): void {
  const list = handlers.get(eventType) ?? [];
  list.push(handler);
  handlers.set(eventType, list);
}

/** 返回该事件类型的所有订阅者（可能多个）。 */
export function getEventHandlers(
  eventType: string
): OutboxEventHandler[] {
  return handlers.get(eventType) ?? [];
}

/** 兼容单订阅者读取：返回第一个订阅者。 */
export function getEventHandler(
  eventType: string
): OutboxEventHandler | undefined {
  return getEventHandlers(eventType)[0];
}

export function listRegisteredEventTypes(): string[] {
  return [...handlers.keys()];
}
