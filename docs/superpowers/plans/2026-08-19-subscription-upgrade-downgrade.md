# 套餐升级/降级（实时生效）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 会员可在订阅套餐页随时切换到其他套餐——升级收差价、降级/平级实时生效且当月已付不退，切换通过"取消旧订阅 + 创建新订阅"完成。

**Architecture:** 在 Membership 应用层新增统一入口 `changeSubscription`：无生效订阅时复用现有首次订阅逻辑；有生效订阅时在单事务内将旧订阅置 CANCELLED、新建 ACTIVE 订阅并写入 outbox 事件。Billing 通过新事件类型 `membership.subscription-upgraded`（记录差价）和 `membership.subscription-downgraded`（不产生费用）响应。UI 根据当前订阅的价格高低显示"升级"/"降级"按钮。

**Tech Stack:** Next.js 16（App Router + Server Actions）、Drizzle ORM（libsql）、vitest、TypeScript

**Spec:** `docs/superpowers/specs/2026-08-19-subscription-upgrade-downgrade-design.md`

## Global Constraints

- 业务不变量：**一个会员同时只能有一个 ACTIVE 订阅**（任何实现不得破坏）
- 差价 = 新月费 − 旧月费（**不按剩余天数折算**，全额）
- 当月已付月费**不退**：升级时 Billing 记录差价；降级/平级时 Billing **不产生**新费用
- 升级/降级**实时生效**：无定时任务、无 PENDING 状态
- 升级差价 referenceId 使用 `sub-upgrade-{month}-{memberId}`（避免与首次订阅 `sub-{month}-{memberId}` 唯一索引冲突）
- UI 判定：价格更高 = 升级；价格更低 = 降级；等于 = 平级
- 所有代码注释沿用项目中文风格
- 测试框架 vitest（`include: ["src/**/*.test.ts"]`），领域层纯函数必须有测试；应用层 DB 代码以 `npx tsc --noEmit` + 全量回归验证

---

### Task 1: 领域层差价纯函数

**Files:**
- Modify: `src/modules/membership/domain/subscription.ts`
- Test: `src/modules/membership/domain/subscription.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `calculatePlanDiff(oldFeeCents: number, newFeeCents: number): number`
  - `classifyPlanChange(oldFeeCents: number, newFeeCents: number): "UPGRADE" | "DOWNGRADE" | "SAME"`

- [ ] **Step 1: 写失败测试**

在 `src/modules/membership/domain/subscription.test.ts` 末尾追加测试块，并把第 2 行 import 改为：

```ts
import { isSubscriptionActive, prorateMonthlyFee, calculatePlanDiff, classifyPlanChange } from "./subscription";
```

追加测试块：

```ts
  it("升级：新月费 > 旧月费，差价为正值，类型为 UPGRADE", () => {
    expect(calculatePlanDiff(49900, 89900)).toBe(40000);
    expect(classifyPlanChange(49900, 89900)).toBe("UPGRADE");
  });

  it("降级：新月费 < 旧月费，差价为负值，类型为 DOWNGRADE", () => {
    expect(calculatePlanDiff(89900, 19900)).toBe(-70000);
    expect(classifyPlanChange(89900, 19900)).toBe("DOWNGRADE");
  });

  it("平级：新月费 = 旧月费，差价为 0，类型为 SAME", () => {
    expect(calculatePlanDiff(49900, 49900)).toBe(0);
    expect(classifyPlanChange(49900, 49900)).toBe("SAME");
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/modules/membership/domain/subscription.test.ts`
Expected: FAIL —— `calculatePlanDiff is not a function`

- [ ] **Step 3: 实现纯函数**

在 `src/modules/membership/domain/subscription.ts` 末尾追加：

```ts
/** 套餐切换差价：新月费 − 旧月费（全额，不按剩余天数折算） */
export function calculatePlanDiff(oldFeeCents: number, newFeeCents: number): number {
  return newFeeCents - oldFeeCents;
}

/** 套餐切换方向：价格更高=升级，更低=降级，相等=平级 */
export function classifyPlanChange(
  oldFeeCents: number,
  newFeeCents: number
): "UPGRADE" | "DOWNGRADE" | "SAME" {
  if (newFeeCents > oldFeeCents) return "UPGRADE";
  if (newFeeCents < oldFeeCents) return "DOWNGRADE";
  return "SAME";
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/modules/membership/domain/subscription.test.ts`
Expected: PASS（原 7 个用例 + 新增 3 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/modules/membership/domain/subscription.ts src/modules/membership/domain/subscription.test.ts
git commit -m "feat(membership): add plan diff calculation pure functions"
```

---

### Task 2: 应用层 changeSubscription

**Files:**
- Modify: `src/modules/membership/application/membership-app.ts`

**Interfaces:**
- Consumes: `calculatePlanDiff` / `classifyPlanChange`（Task 1）、`SubscriptionView`（已有）、`plans`/`subscriptions`/`outboxEvents` schema（已有）
- Produces:
  - `changeSubscription({ memberId: string; planId: string }): Promise<{ subscription: SubscriptionView; changeType: "SUBSCRIBE" | "UPGRADE" | "DOWNGRADE" | "SAME"; diffCents: number }>`
  - 事件：`membership.subscription-upgraded` payload `{ memberId, planType, diffCents }`；`membership.subscription-downgraded` payload `{ memberId, planType, oldMonthlyFeeCents }`

- [ ] **Step 1: 更新 import**

在 `src/modules/membership/application/membership-app.ts` 顶部增加：

```ts
import { calculatePlanDiff, classifyPlanChange } from "../domain/subscription";
```

- [ ] **Step 2: 新增 changeSubscription 函数**

在 `src/modules/membership/application/membership-app.ts` 的 `subscribePlan` 之后（`cancelSubscription` 之前）插入：

```ts
/** 切换套餐：无生效订阅=首次订阅；有生效订阅=升级/降级/平级（实时生效，旧订阅置 CANCELLED） */
export async function changeSubscription(
  input: SubscribePlanInput
): Promise<{
  subscription: SubscriptionView;
  changeType: "SUBSCRIBE" | "UPGRADE" | "DOWNGRADE" | "SAME";
  diffCents: number;
}> {
  const plan = await db
    .select()
    .from(plans)
    .where(eq(plans.id, input.planId))
    .get();
  if (!plan) throw new Error("套餐不存在");

  const activeSub = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.memberId, input.memberId),
        eq(subscriptions.status, "ACTIVE")
      )
    )
    .get();

  // 首次订阅：复用现有 subscribePlan 逻辑
  if (!activeSub) {
    const sub = await subscribePlan(input);
    return { subscription: sub, changeType: "SUBSCRIBE", diffCents: plan.monthlyFeeCents };
  }

  const diffCents = calculatePlanDiff(activeSub.monthlyFeeCents, plan.monthlyFeeCents);
  const changeType = classifyPlanChange(activeSub.monthlyFeeCents, plan.monthlyFeeCents);

  const now = new Date();
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );

  const result = await db.transaction(async (tx) => {
    // 旧订阅 → CANCELLED
    await tx
      .update(subscriptions)
      .set({ status: "CANCELLED", endDate: now, updatedAt: now })
      .where(eq(subscriptions.id, activeSub.id))
      .run();

    // 新订阅 → ACTIVE
    const sub = await tx
      .insert(subscriptions)
      .values({
        memberId: input.memberId,
        planId: plan.id,
        planType: plan.planType,
        monthlyFeeCents: plan.monthlyFeeCents,
        startDate: now,
        endDate: end,
        status: "ACTIVE",
      })
      .returning()
      .get();

    // 事件：升级记录差价；降级/平级不产生费用（当月已付不退）
    const event = createEvent({
      eventType:
        changeType === "UPGRADE"
          ? "membership.subscription-upgraded"
          : "membership.subscription-downgraded",
      aggregateId: sub.id,
      aggregateType: "Subscription",
      payload:
        changeType === "UPGRADE"
          ? { memberId: input.memberId, planType: plan.planType, diffCents }
          : { memberId: input.memberId, planType: plan.planType, oldMonthlyFeeCents: activeSub.monthlyFeeCents },
    });
    await tx
      .insert(outboxEvents)
      .values({
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        payload: JSON.stringify(event.payload),
      })
      .run();

    return sub;
  });

  return { subscription: result, changeType, diffCents };
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS（无新增错误）

- [ ] **Step 4: 提交**

```bash
git add src/modules/membership/application/membership-app.ts
git commit -m "feat(membership): add changeSubscription for plan switch (upgrade/downgrade)"
```

---

### Task 3: 接口层 Server Action

**Files:**
- Modify: `src/modules/membership/interface/actions/subscribe.ts`

**Interfaces:**
- Consumes: `changeSubscription`（Task 2）
- Produces: `changeSubscriptionAction(_prev: SubscribeState, formData: FormData): Promise<SubscribeState>`

- [ ] **Step 1: 更新 import**

`src/modules/membership/interface/actions/subscribe.ts` 第 6-10 行 import 块增加：

```ts
  changeSubscription,
```

即：
```ts
import {
  subscribePlan,
  changeSubscription,
  cancelSubscription,
  getMember,
} from "@/modules/membership/application/membership-app";
```

- [ ] **Step 2: 新增 changeSubscriptionAction**

在 `src/modules/membership/interface/actions/subscribe.ts` 的 `subscribePlanAction` 之后插入：

```ts
/** 切换套餐（首次订阅 / 升级 / 降级 / 平级统一入口，实时生效） */
export async function changeSubscriptionAction(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const memberId = await getSessionMemberId();
  const planId = String(formData.get("planId") ?? "");

  if (!memberId) {
    return { error: "请先登录会员账号" };
  }
  if (!planId) return { error: "请选择套餐" };

  try {
    await changeSubscription({ memberId, planId });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "切换套餐失败" };
  }
  await dispatchOutboxEvents();

  revalidatePath("/profile");
  revalidatePath("/subscription");
  return { error: undefined };
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/modules/membership/interface/actions/subscribe.ts
git commit -m "feat(membership): add changeSubscriptionAction server action"
```

---

### Task 4: Billing 差价记录与事件订阅

**Files:**
- Modify: `src/modules/billing/application/billing-app.ts`
- Modify: `src/modules/billing/application/billing-subscribers.ts`

**Interfaces:**
- Consumes: `insertUsage`（已有私有函数）、`monthKey`（已有私有函数）
- Produces: `recordUpgradeFee({ memberId, planType, diffCents }): Promise<void>`；订阅 `membership.subscription-upgraded` / `membership.subscription-downgraded`

- [ ] **Step 1: billing-app.ts 新增 recordUpgradeFee**

在 `src/modules/billing/application/billing-app.ts` 的 `recordMembershipFee` 之后插入：

```ts
/** 升级差价 → MEMBERSHIP_FEE（referenceId 加 upgrade 前缀，避免与首订唯一索引冲突） */
export async function recordUpgradeFee(params: {
  memberId: string;
  planType: string;
  diffCents: number;
}): Promise<void> {
  const now = new Date();
  await insertUsage({
    memberId: params.memberId,
    chargeType: "MEMBERSHIP_FEE",
    description: `${params.planType} 套餐升级差价`,
    referenceId: `sub-upgrade-${monthKey(now)}-${params.memberId}`,
    durationMs: 0,
    unitRateCents: 0,
    amountCents: params.diffCents,
    occurredAt: now,
  });
}
```

- [ ] **Step 2: billing-subscribers.ts 注册新事件**

`src/modules/billing/application/billing-subscribers.ts`：
- import 增加 `recordUpgradeFee`：
```ts
import {
  recordDeskUsage,
  recordRoomUsage,
  recordFlexUsage,
  recordMembershipFee,
  recordUpgradeFee,
} from "./billing-app";
```
- `registerBillingSubscribers` 末尾（`membership.subscription-changed` 订阅之后）追加：
```ts
  // 升级 → 记录差价；降级/平级 → 当月已付不退，不产生费用（事件保留用于审计/未来通知）
  registerEventHandler("membership.subscription-upgraded", async (payload) => {
    const p = payload as { memberId: string; planType: string; diffCents: number };
    await recordUpgradeFee(p);
  });

  registerEventHandler("membership.subscription-downgraded", async () => {
    // no-op：不产生费用
  });
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/modules/billing/application/billing-app.ts src/modules/billing/application/billing-subscribers.ts
git commit -m "feat(billing): record upgrade diff fee, subscribe upgrade/downgrade events"
```

---

### Task 5: UI 订阅页升级/降级按钮

**Files:**
- Modify: `src/app/(member)/subscription/page.tsx`
- Modify: `src/app/(member)/subscription/subscribe-form.tsx`

**Interfaces:**
- Consumes: `changeSubscriptionAction`（Task 3）
- Produces: `SubscribeForm` 新 props `variant?: "SUBSCRIBE" | "CURRENT" | "UPGRADE" | "DOWNGRADE"`（`disabled` 保留）

- [ ] **Step 1: subscribe-form.tsx 改造**

用 `changeSubscriptionAction` 替换 `subscribePlanAction`，支持升级/降级文案与降级确认：

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { changeSubscriptionAction, type SubscribeState } from "@/modules/membership/interface/actions/subscribe";

const initialState: SubscribeState = {};

export type PlanVariant = "SUBSCRIBE" | "CURRENT" | "UPGRADE" | "DOWNGRADE";

export function SubscribeForm({
  planId,
  disabled,
  variant = "SUBSCRIBE",
}: {
  planId: string;
  disabled: boolean;
  variant?: PlanVariant;
}) {
  const [state, action, pending] = useActionState(changeSubscriptionAction, initialState);

  const label = disabled
    ? "已订阅"
    : pending
      ? "订阅中…"
      : variant === "UPGRADE"
        ? "升级"
        : variant === "DOWNGRADE"
          ? "降级"
          : "立即订阅";

  return (
    <form
      action={action}
      onSubmit={
        variant === "DOWNGRADE"
          ? (e) => {
              if (!window.confirm("降级立即生效，当月已付月费不退，确定降级？")) {
                e.preventDefault();
              }
            }
          : undefined
      }
    >
      <input type="hidden" name="planId" value={planId} />
      {state.error && <p className="mb-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={disabled || pending}>
        {label}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: page.tsx 计算按钮状态**

`src/app/(member)/subscription/page.tsx`：
- 删除第 8 行未使用的 `import { subscribePlanAction } from "@/modules/membership/interface/actions/subscribe";`
- 第 9 行改为：
```ts
import { SubscribeForm, type PlanVariant } from "./subscribe-form";
```
- 将 `plans.map((p) => ...)` 的卡片内替换为：

```tsx
        {plans.map((p) => {
          const isCurrent = p.id === activeSub?.planId;
          const variant: PlanVariant = !activeSub
            ? "SUBSCRIBE"
            : isCurrent
              ? "CURRENT"
              : p.monthlyFeeCents > activeSub.monthlyFeeCents
                ? "UPGRADE"
                : "DOWNGRADE";
          return (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <p className="text-3xl font-bold">{formatYuan(p.monthlyFeeCents)}</p>
                <p className="text-xs text-muted-foreground">/月</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{p.description}</p>
                <SubscribeForm planId={p.id} disabled={isCurrent} variant={variant} />
              </CardContent>
            </Card>
          );
        })}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add "src/app/(member)/subscription/page.tsx" "src/app/(member)/subscription/subscribe-form.tsx"
git commit -m "feat(subscription): upgrade/downgrade buttons on plans page"
```

---

### Task 6: 全量回归验证

**Files:** 无

- [ ] **Step 1: 运行全部测试**

Run: `npx vitest run`
Expected: 全部 PASS（原 134 + Task 1 新增 3 = 137）

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 无遗留 diff 检查**

Run: `git status --short`
Expected: 仅展示已完成任务的提交产物；如有未提交改动，确认属于本次功能后一并提交
