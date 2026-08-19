# 套餐升级/降级功能设计

> 日期：2026-08-19
> 状态：已确认（用户批准方案 A + 实时生效 + 全额差价 + 当月已付不退）

## 一、背景与目标

当前系统只支持"首次订阅"和"取消订阅"（`subscribePlan` / `cancelSubscription`），
会员已有生效套餐时无法切换到其他套餐（`subscribePlan` 会抛错"已有生效套餐"）。

业务需求（来自 `design/pricing-scenarios-analysis.md` 场景 #2/#3）：

- **套餐升级**：FLEX_DESK(¥499) → FIXED_DESK(¥899)，立即生效，补差价
- **套餐降级**：FIXED_DESK → VIRTUAL(¥199)，立即生效，当月已付不退，下月按新价

### 用户确认的业务决策

1. **方案 A**：升级/降级 = 取消旧订阅 + 创建新订阅（两条记录，历史可追溯）
2. **简单收全额差价**：差价 = 新月费 − 旧月费（不按剩余天数折算）
3. **当月已付月费不退**：当月账单按旧价（已付不退），下月按新价
4. **升级/降级均实时生效**（无需定时任务 / 无需 PENDING 状态）
5. **UI 判定**：价格高于当前 = 升级；价格低于当前 = 降级；等于 = 平级

## 二、领域模型设计

### 2.1 核心流程（统一 `changeSubscription`）

```
changeSubscription(memberId, planId)
  ├─ 无生效订阅 → 首次订阅（复用现有 subscribePlan 逻辑）
  └─ 有生效订阅 → 切换套餐（事务内）：
       ├─ 旧订阅 → CANCELLED（endDate = 切换时刻）
       ├─ 新订阅 → ACTIVE（startDate = 切换时刻，endDate = 下月同日）
       └─ diffCents = 新月费 − 旧月费
            ├─ diffCents > 0 → 升级 → 发 subscription-upgraded 事件（含差价）
            ├─ diffCents < 0 → 降级 → 发 subscription-downgraded 事件（不产生费用）
            └─ diffCents = 0 → 平级 → 发 subscription-downgraded 事件（不产生费用）
```

### 2.2 领域规则

- 业务不变量不变：**一个会员同时只能有一个 ACTIVE 订阅**
- 切换后旧订阅置为 CANCELLED，新订阅 ACTIVE，历史记录完整
- 差价计算为**纯函数**（领域层）：`calculatePlanDiff(oldFeeCents, newFeeCents) = newFeeCents - oldFeeCents`

### 2.3 计费规则

| 场景 | 当月账单 | 下月账单 |
|------|---------|---------|
| 升级（FLEX ¥499 → FIXED ¥899） | 已付 ¥499 + 补差价 ¥400 = ¥899 | 按 ¥899 |
| 降级（FIXED ¥899 → VIRTUAL ¥199） | 已付 ¥899（不退） | 按 ¥199 |

- 升级：Billing 记录 `MEMBERSHIP_FEE` = 差价（¥400）
- 降级/平级：Billing **不记录**新费用（当月已付旧价不退）
- 降级后当月账单的正确性：首次订阅时已记录旧价 MEMBERSHIP_FEE，`generateMonthlyInvoice`
  的补入逻辑仅在"无 MEMBERSHIP_FEE 记录"时从 ACTIVE 订阅补入，故当月不会错误补入新价 ✅

### 2.4 事件设计

| 事件类型 | 触发场景 | payload | Billing 行为 |
|---------|---------|---------|-------------|
| `membership.subscription-changed`（现有） | 首次订阅 | memberId, planType, monthlyFeeCents | 记录全额月费（不变） |
| `membership.subscription-upgraded`（新增） | 升级 | memberId, planType, diffCents | 记录差价 |
| `membership.subscription-downgraded`（新增） | 降级 / 平级 | memberId, planType, oldMonthlyFeeCents | 不记录费用 |

## 三、接口与文件变更

### 3.1 领域层

**`src/modules/membership/domain/subscription.ts`**
- 新增 `calculatePlanDiff(oldFeeCents: number, newFeeCents: number): number`
- 新增 `classifyPlanChange(oldFeeCents, newFeeCents): "UPGRADE" | "DOWNGRADE" | "SAME"`

### 3.2 应用层

**`src/modules/membership/application/membership-app.ts`**
- 新增 `changeSubscription({ memberId, planId })`，返回
  `{ subscription, changeType: "SUBSCRIBE" | "UPGRADE" | "DOWNGRADE" | "SAME", diffCents }`
- 内部：无 ACTIVE → 复用现有订阅创建逻辑（首次订阅）；有 ACTIVE → 事务内切换
  （旧置 CANCELLED、新建 ACTIVE、写 outbox 事件）
- `subscribePlan` 保留为 `changeSubscription` 内部复用的首次订阅逻辑；对外调用统一走 `changeSubscription`

### 3.3 接口层

**`src/modules/membership/interface/actions/subscribe.ts`**
- 新增 `changeSubscriptionAction(_prev, formData)`：调用 `changeSubscription`，成功后
  `dispatchOutboxEvents()` + `revalidatePath("/subscription")` + `revalidatePath("/profile")`
- 订阅页面 UI 统一改用 `changeSubscriptionAction`（首次订阅 / 升级 / 降级都走它）
- `subscribePlanAction` / `cancelSubscriptionAction` 保留（`subscribePlanAction` 不再被订阅页引用）

### 3.4 Billing

**`src/modules/billing/application/billing-app.ts`**
- 新增 `recordUpgradeFee({ memberId, planType, diffCents })`：
  `chargeType: "MEMBERSHIP_FEE"`，description `${planType} 套餐升级差价`，
  referenceId `sub-upgrade-${monthKey}-${memberId}`（避免与首次订阅的
  `sub-${monthKey}-${memberId}` 唯一索引冲突），amountCents = diffCents

**`src/modules/billing/application/billing-subscribers.ts`**
- 注册 `membership.subscription-upgraded` → `recordUpgradeFee`
- 注册 `membership.subscription-downgraded` → no-op（不记录费用；事件用于审计/未来通知）

### 3.5 UI

**`src/app/(member)/subscription/page.tsx`**
- 每个套餐卡片根据 `activeSub` 计算按钮状态：
  - `p.id === activeSub?.planId` → 已订阅（disabled）
  - `p.monthlyFeeCents > activeSub.monthlyFeeCents` → 升级
  - `p.monthlyFeeCents < activeSub.monthlyFeeCents` → 降级
- 传 `variant`（"UPGRADE" / "DOWNGRADE"）给 `SubscribeForm`

**`src/app/(member)/subscription/subscribe-form.tsx`**
- 按钮文案：`已订阅` / `升级` / `降级` / `订阅中…` / `立即订阅`
- 降级按钮点击前需确认（"当月已付月费不退，立即生效，确定？"）——用原生 `confirm` 或简单二次确认

### 3.6 测试

- **领域层**：`subscription.test.ts` 增补 `calculatePlanDiff` / `classifyPlanChange` 用例
- **应用层**：新增 `changeSubscription` 测试（升级差价、降级不退、平级、切换后单 ACTIVE、事件写入）
- 运行 `npx vitest run` 全量回归 + `npx tsc --noEmit`

## 四、边界情况

1. **降级当月账单**：首次订阅时已记录旧价 MEMBERSHIP_FEE，`generateMonthlyInvoice`
   不会从新 ACTIVE 订阅错误补入新价（已有记录）
2. **升级差价 referenceId 唯一性**：`sub-upgrade-{month}-{memberId}` 与首次订阅
   `sub-{month}-{memberId}` 不同，避开唯一索引（chargeType + referenceId）冲突
3. **取消订阅**：现有 `cancelSubscription` 流程不变
4. **重复点击**：前端 pending 状态防重复提交（现有 `useActionState` 已处理）
5. **切换到相同套餐**：UI 上已订阅卡片 disabled，不会触发

## 五、验收标准

- [ ] 会员有 ACTIVE 订阅时，可切换到任意其他套餐（升级/降级/平级）
- [ ] 切换后旧订阅 CANCELLED、新订阅 ACTIVE，且同一会员只有一条 ACTIVE
- [ ] 升级时 Billing 记录差价；降级/平级时不产生新费用
- [ ] 当月账单按旧价（已付不退），下月账单按新价
- [ ] UI：当前套餐"已订阅"，价格更高"升级"，价格更低"降级"
- [ ] 全部测试通过，`npx tsc --noEmit` 通过
