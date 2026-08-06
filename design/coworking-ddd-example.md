# 🏢 共享办公空间领域建模示例

## 场景：「蜂巢共享办公」

> 小张是「蜂巢」的会员。他在 App 上预订了明天 9:00-18:00 的靠窗工位 B-12，顺便约了一间 4 人会议室下午 2 点到 3 点。到前台扫会员码，闸机放行。用完会议室后系统自动结束计费。月底收到账单：会员费 ¥899 + 会议室超时 ¥40。

这个看似简单的流程，背后涉及 **6 个限界上下文** 的协作。

---

## 一、识别限界上下文 (Bounded Contexts)

从 **业务能力** 和 **语言边界** 出发：

| 限界上下文 | 核心职责 | 自己的语言 |
|-----------|---------|-----------|
| **Membership** 🪪 | 会员注册、套餐、身份管理 | 会员、套餐、积分等级 |
| **Booking** 📅 | 工位预订、会议室预订、**灵活区管理** | 时段、资源、锁定、释放、灵活会话 |
| **Access** 🚪 | 门禁/闸机控制、通行记录审计 | 通行证、扫码、闸机、通行记录、进出方向 |
| **Billing** 💰 | 计费、发票、支付 | 账单、费率、信用额度、流水 |
| **Facility** 🏗️ | 空间/设备维护、**闸机设备管理**、**灵活区域管理** | 工位、会议室、闸机、灵活区域、区域状态、营业时间 |
| **Notification** 📱 | 消息推送 | 通知模板、推送渠道、送达状态 |

> ⚠️ **注意**：这不是微服务拆分——是 **概念边界**。每个上下文内，同一个词可能有不同含义。比如 "会员" 在 Membership 里是 VIP 等级的订阅者，在 Access 里只是一串通行编码。

---

## 二、上下文映射 (Context Map) — CML 表述

```cml
ContextMap HiveCoworkingMap {
    type = SYSTEM_LANDSCAPE
    state = TO_BE

    contains MembershipContext
    contains BookingContext
    contains AccessContext
    contains BillingContext
    contains FacilityContext
    contains NotificationContext

    // 预订完成后，发消息通知
    BookingContext [OHS, PL] -> NotificationContext

    // 预订完成后，生成通行授权
    BookingContext [OHS, PL] -> AccessContext {
        exposedAggregates BookingPass
    }

    // 预订使用后，通知计费
    BookingContext [OHS, PL] -> BillingContext {
        exposedAggregates UsageRecord
    }

    // 会员中心告诉预订系统"这个人是谁"
    MembershipContext [OHS, PL] -> BookingContext {
        exposedAggregates MemberIdentity
    }

    // 会员变更套餐 → 调整账单
    MembershipContext [OHS, PL] -> BillingContext

    // 设施状态影响哪些资源可预订
    FacilityContext <- [ACL] BookingContext

    // 门禁验证会员通行权限
    AccessContext -> [ACL] MembershipContext

    // 计费和会员共享"信用额度"（共享内核，小范围）
    MembershipContext [SK] BillingContext

    // 闸机设备状态变化通知门禁系统
    FacilityContext [OHS, PL] -> AccessContext {
        exposedAggregates GateStatus
    }

    // 灵活区域状态变化通知预订系统（如区域维护中则暂停入场）
    FacilityContext [OHS, PL] -> BookingContext {
        exposedAggregates FlexZoneStatus
    }
}
```

### 关系图

```
                       ┌──────────────┐
                       │ Notification │◄──── 预订触发通知
                       └──────────────┘
                               ▲
                               │ OHS/PL
                               │
     ┌──────────┐   OHS/PL  ┌──────────┐──── OHS/PL ────►┌──────────┐
     │Membership│◄─────────►│ Booking  │                  │  Access  │
     │  🪪      │   SK      │  📅      │◄───────────────  │  🚪      │
     └────┬─────┘   (额度)  └──┬──┬────┘  ACL(设施状态)   └────┬─────┘
          │                    │  │                              │
          │ OHS/PL     OHS/PL  │  │ OHS/PL (区域状态)       OHS/PL│
          ▼                    │  │                         (闸机状态)│
     ┌──────────┐              │  │    ┌──────────┐              │
     │  Billing │◄─────────────┘  └────┤ Facility │◄─────────────┘
     │   💰      │   OHS/PL(用量)       │  🏗️      │
     └──────────┘                      └──────────┘
```

---

## 三、深入一个上下文 — Booking 限界上下文内部

```cml
BoundedContext BookingContext implements SpaceReservationDomain {
    type = CORE_DOMAIN
    domainVisionStatement = "管理工位和会议室的预订、锁定、释放和计时"
    implementationTechnology = "Spring Boot"

    // ============== 聚合：工位预订 ==============
    Aggregate DeskBooking {
        Entity Booking {
            aggregateRoot

            - BookingId bookingId
            - MemberId memberId        // 引用 Membership 上下文的会员
            - DeskId deskId            // 引用 Facility 上下文的工位
            - TimeSlot timeSlot        // 值对象：时间段
            BookingStatus status
            - UsageRecord usageRecord

            // 行为（不是 setter！是业务方法）
            void confirm()  // 确认预订
            void cancel()   // 取消（30分钟前免费）
            void checkIn()  // 扫码签到
            void checkOut() // 释放工位

            // 业务不变量
            invariant "已确认的预订才能签到"
            invariant "已签到的才能签退"
            invariant "取消只能在预订开始30分钟前"
        }

        ValueObject TimeSlot {
            LocalDateTime startTime
            LocalDateTime endTime

            // 值对象的行为
            Duration duration()
            boolean overlapsWith(TimeSlot other)
            boolean isBefore(LocalDateTime moment)
        }

        enum BookingStatus {
            PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW
        }

        ValueObject BookingId {
            UUID id
        }

        Repository BookingRepository {
            List<Booking> findByMemberAndDate(MemberId memberId, LocalDate date)
            List<Booking> findByDeskAndTimeSlot(DeskId deskId, TimeSlot timeSlot)
        }

        DomainEvent BookingConfirmed {
            BookingId bookingId
            MemberId memberId
            TimeSlot timeSlot
        }

        DomainEvent BookingCheckedIn {
            BookingId bookingId
            LocalDateTime checkInTime
        }

        DomainEvent BookingCheckedOut {
            BookingId bookingId
            LocalDateTime checkOutTime
            Duration actualDuration
        }
    }

    // ============== 聚合：会议室预订 ==============
    Aggregate MeetingRoomBooking {
        Entity RoomBooking {
            aggregateRoot

            - RoomBookingId roomBookingId
            - MemberId bookerId
            - RoomId roomId
            - TimeSlot timeSlot
            - int expectedAttendees
            RoomBookingStatus status
        }

        enum RoomBookingStatus {
            PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
        }

        DomainEvent RoomBookingCompleted {
            RoomBookingId roomBookingId
            TimeSlot actualTimeSlot  // 实际使用时长，用于计费
        }

        // 应用服务层
        Service BookingApplicationService {
            @BookingConfirmed createDeskBooking(@CreateDeskBookingCommand cmd);
            @RoomBookingCompleted completeRoomBooking(@CompleteRoomBookingCommand cmd);
            List<@Booking> findMemberUpcomingBookings(@MemberId memberId);
        }
    }
}
```

---

## 三-B、灵活区使用（FlexSession）— 专为 FLEX_DESK 设计

FLEX_DESK 会员不绑定固定工位，流程与 FIXED_DESK 完全不同，所以单独立一个 **`FlexSession`（灵活区使用会话）** 聚合。

### FLEX_DESK 完整流程

```
┌─ FLEX_DESK 会员到访流程 ──────────────────────────────────┐

  Member                        Access                  Booking/Flex
   │                            │                          │
   │  1. 出示会员码              │                          │
   │──────────────────────────►  │                          │
   │                            │  2. ACL 查套餐类型        │
   │                            │──── (ACL) ──────────►     │
   │                            │◄── PlanType=FLEX_DESK ──  │
   │                            │                          │
   │                            │  3. 创建 GatePass         │
   │                            │    授权: 灵活区闸机       │
   │                            │    有效期: 当日营业时段    │
   │  4. 闸机开启               │                          │
   │◄───────────────────────────│                          │
   │                            │  5. 异步通知 Booking      │
   │                            │──── Event ───────────►   │
   │                            │                          │  6. 创建 FlexSession
   │                            │                          │     status=ACTIVE
   │                            │                          │     开始计时
   │                            │                          │
   │  7. 灵活区选座              │                          │
   │  ── 自由入座 ──            │                          │
   │  找个空位坐下（系统不干涉）   │                          │
   │  ── 或 App 签到占座 ──     │                          │
   │  App 显示可用工位列表       │◄── findAvailableDesks ── │
   │  选一个坐下                │                          │
   │                            │                          │
   │  8. 离场刷卡               │                          │
   │──────────────────────────►  │                          │
   │                            │  9. GateAccessGranted     │
   │                            │──── Event ───────────►   │
   │                            │                          │  10. FlexSessionEnded
   │                            │                          │      status=COMPLETED
   │                            │                          │      通知 Billing 结算
```

### FlexSession 聚合结构

```cml
Aggregate FlexSession {
    Entity FlexSession {              // 聚合根
        aggregateRoot
        - FlexSessionId sessionId     // 会话ID
        - MemberId memberId           // 会员
        - ZoneId flexZoneId           // 所在灵活区域（引用FacilityContext）
        - DeskId assignedDeskId?      // 可选：选了具体工位就记录(引用Facility)
        LocalDateTime checkInTime     // 入场签到时间
        LocalDateTime checkOutTime    // 离场签退时间
        FlexSessionStatus status      // 当前状态
    }

    enum FlexSessionStatus {
        ACTIVE,      // 在场中
        COMPLETED,   // 已离场
        NO_SHOW      // 未到
    }

    Service FlexSeatingService {
        @FlexSessionStarted checkIn(@FlexCheckInCommand cmd);
        @FlexSessionEnded checkOut(@FlexCheckOutCommand cmd);
        List<@DeskId> findAvailableDesks(@ZoneId zoneId);
    }
}
```

### 为什么 FLEX_DESK 和 FIXED_DESK 不能用同一个聚合？

| 维度 | FIXED_DESK → DeskBooking | FLEX_DESK → FlexSession |
|------|-------------------------|------------------------|
| 核心概念 | **预订**一个具体工位 | **到访会话**，不绑定座位 |
| 工位 | 必须指定 DeskId | 不指定，或者离场后记录 |
| 时间 | 预约未来时段 (TimeSlot) | 记录实际起止 (checkIn/Out) |
| 状态 | PENDING→CONFIRMED→CHECKED_IN→... | ACTIVE→COMPLETED 更简单 |
| 计费触发 | 预订时确定费率 | 离场时才按实际时长结算 |

---

## 四、跨上下文协作 — "扫码开门" 事件流

```
┌─ 场景：会员 APP 扫码开门 ──────────────────────────────┐

  Member                        Access                    Booking
   │                            │                          │
   │  1. 出示会员码              │                          │
   │──────────────────────────►  │                          │
   │                            │  2. 校验会员身份           │
   │                            │──── (ACL) ──────────►     │
   │                            │    "这个 token 有效吗？"   │
   │                            │◄──── 会员信息 ──────────  │
   │                            │                          │
   │                            │  3. 查询当日有效预订       │
   │                            │──── (REST) ──────────►    │
   │                            │    "此人今天有哪个工位？"   │
   │                            │◄──── Booking B-12 ──────  │
   │                            │                          │
   │                            │  4. 开门 + 签到           │
   │◄─────── 闸机开启 ──────────│                          │
   │                            │  5. 异步通知 Booking      │
   │                            │──── (Event) ──────────►  │
   │                            │    "Booking B-12 已签到"  │
```

### 补充：每次开门都留下 AccessLog

每次会员扫码通过闸机，除了更新 GatePass 状态外，还会在 AccessContext 中持久化一条 **`AccessLogEntry`** 通行记录：

| 字段 | 记录内容 |
|------|---------|
| 谁？ | memberId |
| 用哪个通行证？ | gatePassId |
| 从哪个闸机？ | gateId |
| 什么时间？ | accessTime |
| 进还是出？ | direction (ENTRY/EXIT) |
| 成功了还是被拒？ | result (GRANTED/DENIED_*) |

这些记录用于安全审计、运营分析（高峰人流量）和异常检测。

### Gate 设备管理归属 FacilityContext

闸机（Gate）作为物理设备，与工位（Desk）、会议室（MeetingRoom）一样归属于 **FacilityContext**，由同一套资产管理系统维护。AccessContext 只通过 `GateId` 值对象引用，并通过监听 `GateStatusChanged` 事件来感知闸机状态变化。

### 灵活区域（FlexZone）同理归属 FacilityContext

**您的判断完全正确**——灵活区域（FlexZone）也是物理空间资源，和 Gate 一样应该放在 FacilityContext：

| 物理资源 | 归属上下文 | 管理内容 | 被谁引用 |
|---------|-----------|---------|---------|
| Desk（工位） | FacilityContext | 位置、类型、状态 | BookingContext |
| MeetingRoom（会议室） | FacilityContext | 容纳人数、设备、状态 | BookingContext |
| Gate（闸机） | FacilityContext | 位置、类型、运行状态 | AccessContext |
| **FlexZone（灵活区域）** | **FacilityContext** ✅ | **容量、营业时间、状态** | **BookingContext** |

BookingContext 中的 `FlexSession` 不再直接持有区域的全部信息，而是通过 `ZoneId` 值对象跨上下文引用，并监听 `FlexZoneStatusChanged` 事件来感知区域状态（营业/关闭/维护中）。

---

## 五、Event Storming 中的关键业务发现

| 发现 | 建模影响 |
|------|---------|
| "签到后 15 分钟未到自动释放工位" | → 引入 `NoShowPolicy` 领域服务，配合 `ScheduledTask` |
| "工位可以按天/周/月/灵活时长" | → 不是简单的 OrderLineItem，而是 `RatePolicy` 策略模式 |
| "会议室超时 15 分钟内不额外收费" | → `GracePeriod` 值对象，属于 Billing 上下文 |
| "企业会员可以为员工统一开卡" | → 引入了 `CorporateAccount` 聚合，横跨 Membership 和 Billing |

---

## 六、为什么这个例子值得参考

| 对比维度 | ❌ 传统订单-明细 | ✅ 共享办公 |
|---------|----------------|-----------|
| **上下文数量** | 2~3 个（订单、库存、支付） | **6 个明确上下文** |
| **关系多样性** | 几乎全是上下游 | **OHS/PL、ACL、Shared Kernel、Event-driven** 全有 |
| **战术模式** | Entity + ValueObject 基本够用 | **DomainEvent、Service、Policy、Saga、Repository** 全齐 |
| **业务规则** | 价格 × 数量 = 总价 | 有时间窗口、免罚期、积分等级、NoShow 等丰富规则 |
| **真实感** | 所有教学项目都用 | 现实中的 WeWork/氪空间背后就是这个模型 |
