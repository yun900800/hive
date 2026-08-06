# 🧩 聚合根的本质 — DDD 战术篇

> 本文是方法论总结：无论用什么语言实现 DDD，聚合根（Aggregate Root）的底层本质不变，外表（实现形态）多种多样。
> 配套阅读：`design/coworking-ddd-example.md`（领域建模示例）。

---

## 一、本质定义

聚合根的本质是：

> **一组被业务规则守护的、必须整体一致变化的状态（一致性边界）。**

- **属性**是它的材料（承载状态）
- **业务方法**是守护规则的手段（保护不变量）
- **边界 + 不变量**才是它的灵魂

---

## 二、三层辨析：为什么"属性 + 业务方法"不是聚合根的独特之处

如果聚合根的本质只是"属性 + 业务方法"，那么**所有对象都是聚合根**——DTO 也有属性，工具类也有方法。真正把聚合根与其他对象区分开的是下面两条：

### ① 一致性边界（Consistency Boundary）

聚合根是一簇对象（实体 + 值对象）的**整体**，边界内**要么全变、要么全不变**。

以工位预订为例：修改时 `status`、`checkedInAt`、`checkedOutAt`、`cancelledAt` 必须作为整体被更新——你不能只改 `status` 却不更新时间戳。

### ② 不变量保护（Invariant Enforcement）

业务方法存在的意义不是"能操作属性"，而是"**某些属性组合永远不允许出现**"。

规则约束的是**状态与状态之间的关系**，不是单个属性本身。例如：不允许 `CHECKED_IN → CONFIRMED` 的状态倒退；取消只能在预订开始 30 分钟前。

---

## 三、本质 vs 表现（语言实现对比）

| 语言/范式 | 聚合根形态 | 业务方法 | 不变量守护 |
|-----------|-----------|---------|-----------|
| **Java（OO）** | `class DeskBooking { private status; confirm() {...} }` | 方法隐式持有 `this` | 方法内 `if (status != PENDING) throw` |
| **TypeScript（本项目）** | `type DeskBooking = {...}` + `confirmBooking(booking, now)` | 方法显式传入聚合（纯函数） | `if (status !== "PENDING") return fail(...)` |
| **FP 语言** | 记录（Record）+ 模块函数 | 通过 currying 隐藏聚合参数 | 纯函数返回值/类型系统约束 |

三种形态**语义等价**：`deskBooking.confirm(now)`（Java）与 `confirmBooking(booking, now)`（TS）画的是同一张状态机图，只是 receiver 从隐式 `this` 变成了显式第一参数。

> 💡 **结论**：语言只是载体，决定了材料的形状；本质（边界 + 不变量）与语言无关。

---

## 四、项目代码佐证（`src/modules/booking/domain/desk-booking.ts`）

### 4.1 一致性边界 — `patch()` 保证整体变更

```ts
function patch(booking: DeskBooking, changes: BookingPatch, now: Date): DeskBooking {
  return { ...booking, ...changes, updatedAt: now };  // 状态 + 时间戳永远一起变
}
```

### 4.2 不变量保护 — 每个业务方法都守护状态转换

```ts
/** CONFIRMED → CHECKED_IN（扫码签到） */
export function checkInDeskBooking(booking: DeskBooking, now: Date): TransitionResult<DeskBooking> {
  if (booking.status !== "CONFIRMED") {
    return fail(`无法签到：当前状态 ${booking.status}（仅 CONFIRMED 可签到）`);
  }
  return result(patch(booking, { status: "CHECKED_IN", checkedInAt: now }, now));
}
```

### 4.3 聚合根的本质 = 状态机图

DeskBooking 的全部合法状态转换，就是聚合根灵魂的直观呈现：

```
PENDING ──确认──► CONFIRMED ──签到──► CHECKED_IN ──签退──► CHECKED_OUT
                        │  ▲                    │
                        │  └── 30 分钟前免费取消 ┘
                        ▼
              CANCELLED / NO_SHOW
```

> 业务不变量（`design/core-business.md`）：
> - 已确认的预订才能签到
> - 已签到的才能签退
> - 取消只能在预订开始 30 分钟前
> - 签到后 15 分钟未到 → NO_SHOW

---

## 五、本项目聚合根形态图谱

| 模块 | 聚合根（属性 = type） | 业务方法（纯函数） | 形态 |
|------|---------------------|------------------|------|
| **booking** | DeskBooking / RoomBooking / FlexSession | 状态机流转方法（confirm / checkIn / checkOut / cancel…） | ✅ 属性 + 方法同文件 |
| **billing** | Invoice | buildInvoice / markInvoicePaid / isInvoicePaid | ✅ 属性 + 方法同文件 |
| **access** | GatePass | canGrantAccess / markPassUsed / revokePass / isExpired | ✅ 属性 + 方法同文件 |
| **facility** | Desk / MeetingRoom | buildDeskCode / isDeskAvailable（领域服务） | ⚠️ 方法散落为规则 |
| **membership** | Subscription | isSubscriptionActive / prorateMonthlyFee（领域服务） | ⚠️ 方法散落为规则 |

> booking / billing / access 三个模块的业务方法直接接收聚合对象并返回新对象（`fn(聚合, ...) => 聚合`），本质就是 `聚合.方法(...)` 的显式传参形式。
>
> facility / membership 的规则函数接收的是标量/状态枚举而非聚合对象，对应 DDD 里的**领域服务（Domain Service）**，不属于聚合根方法。

---

## 六、如何审视聚合根（实用方法）

### ✅ 用状态机图，而不是字段列表

- **字段会骗你**：看着字段很多，其实可能没有业务规则（贫血模型）
- **状态机不会**：一个合格的聚合根，其业务方法应当能画出一张合法的状态转换图

### 判定清单（快速自查）

- [ ] 状态变更是否永远整体发生（边界内要么全变、要么全不变）？
- [ ] 是否存在任何"不允许出现的状态组合"？（不变量）
- [ ] 业务方法是否通过**公开操作**（而非 setter）修改状态？
- [ ] 外部访问聚合内部对象，是否必须经过聚合根（不绕过）？
- [ ] 跨聚合修改是否禁止？（只能引用 ID，不能直接改别的聚合）

---

## 七、一句话总结

> **聚合根的本质是"一组被业务规则守护的、必须整体一致变化的状态"；属性和业务方法只是承载它的两种材料，语言决定了材料的形状，但决定不了本质。**
