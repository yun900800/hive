# 蜂巢共享办公 — 核心业务模型

> 聚焦 Booking（预订）和 Billing（计费）两个 CORE_DOMAIN，
> 这是整个系统的**价值中枢**，所有收入最终从这里产生。

---

## 场景映射

> 小张预订工位 B-12（明天 9:00-18:00）+ 会议室（14:00-15:00）
> → 扫码过闸机 → 用完会议室自动计费（超时 ¥40）
> → 月底账单：会员费 ¥899 + 会议室超时 ¥40

场景中每一块钱的流向：

```
会员费 ¥899     → Membership 套餐费 → Billing 账单
工位使用费 ¥0   → FIXED_DESK 含在套餐内，不另收费
会议室超时 ¥40  → RoomBooking 超时 → OvertimePolicy 计算 → Billing 账单
```

---

## 一、BookingContext — 预订核心业务

### 1.1 三个聚合 = 三种完全不同的业务模式

| 聚合 | 适用场景 | 核心概念 | 计费方式 | 工位绑定 |
|------|---------|---------|---------|---------|
| **DeskBooking** | FIXED_DESK 会员预订固定工位 | 预约未来时段 | 含在套餐内 | 必须指定 DeskId |
| **MeetingRoomBooking** | 所有会员预订会议室 | 按次使用、按小时 | 按实际时长 + 超时费 | 无 |
| **FlexSession** | FLEX_DESK 会员灵活区到访 | 到访会话，不绑定座位 | 按实际在场时长 | 不指定 / 离场后记录 |

### 1.2 核心状态机（业务不变量）

#### DeskBooking — 工位预订生命周期

```
                  ┌─────────┐
                  │ PENDING │
                  └────┬────┘
                       │ 确认
                  ┌────▼────┐
                  │CONFIRMED│◄──────────────┐
                  └────┬────┘               │
                       │ 扫码签到            │
                  ┌────▼────┐               │
                  │CHECKED_IN│              │
                  └────┬────┘               │
                       │ 签退                │ 30分钟前免费取消
                  ┌────▼────┐               │
                  │CHECKED_OUT│             │
                  └──────────┘              │
                                       ┌────▼────┐
                                       │CANCELLED│
                                       └─────────┘
                                       
                       15分钟未签到 ──► NO_SHOW
```

**业务不变量（invariant）：**
- 已确认的预订才能签到
- 已签到的才能签退
- 取消只能在预订开始 **30 分钟前**
- 签到后 **15 分钟**未到 → 自动释放为 NO_SHOW

#### MeetingRoomBooking — 会议室预订生命周期

```
PENDING ──► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
                                      ↘
                                   CANCELLED
```

#### FlexSession — 灵活区会话生命周期

```
ACTIVE ──► COMPLETED
        ↘
      NO_SHOW
```

> 灵活区没有"预订"概念，只有**入场 → 在场 → 离场**的会话。

### 1.3 核心领域服务与业务规则

```
Service BookingPolicies {
    // 取消窗口规则：预订开始前30分钟可免费取消，之后不可取消
    boolean canCancel(@Booking booking, @LocalDateTime cancelTime);
    
    // NoShow 规则：签到后15分钟未到场自动释放工位
    // 防止资源被占用但不使用，是空间利用率的关键规则
    boolean isNoShow(@Booking booking);
}
```

### 1.4 应用服务（用例编排）

```
Service BookingApplicationService {
    // 创建工位预订 → 锁定资源 → 发布 BookingConfirmed
    // 触发：Access 创建 GatePass + Notification 发消息
    @BookingConfirmed createDeskBooking(@CreateDeskBookingCommand cmd);
    
    // 完成会议室 → 停止计时 → 发布 RoomBookingCompleted
    // 触发：Billing 按实际时长 + GracePeriod 计算费用
    @RoomBookingCompleted completeRoomBooking(@CompleteRoomBookingCommand cmd);
    
    // 签到 → 更新状态 → 发布 BookingCheckedIn
    // 触发：Billing 开始计费
    @BookingCheckedIn checkIn(@CheckInCommand cmd);
    
    // 签退 → 释放资源 → 发布 BookingCheckedOut
    // 触发：Billing 结算
    @BookingCheckedOut checkOut(@CheckOutCommand cmd);
}

Service FlexSeatingService {
    // 灵活区入场 → 创建 FlexSession(ACTIVE) → 开始计时
    @FlexSessionStarted checkIn(@FlexCheckInCommand cmd);
    
    // 灵活区离场 → 结束 FlexSession → 发布 FlexSessionEnded
    // 触发：Billing 按实际在场时长结算
    @FlexSessionEnded checkOut(@FlexCheckOutCommand cmd);
    
    // 查询灵活区当前可用工位
    List<@DeskId> findAvailableDesks(@ZoneId zoneId);
}
```

---

## 二、BillingContext — 计费核心业务

### 2.1 五种费用类型（收入来源）

| ChargeType | 来源 | 计费方式 | 场景中的体现 |
|------------|------|---------|------------|
| **MEMBERSHIP_FEE** | 套餐月费 | 固定金额 / 月 | 小张的 ¥899 |
| **DESK_USAGE** | 固定工位使用 | 含在套餐内 / 按天加购 | — |
| **FLEX_USAGE** | 灵活区使用 | 按实际在场时长 × 单价 | — |
| **ROOM_USAGE** | 会议室使用 | 按预订时长 × 小时单价 | 2:00-3:00 按 1 小时计 |
| **OVER_TIME_PENALTY** | 会议室超时罚金 | 超时时长 × 超时单价，扣除 GracePeriod | 小张的超时 ¥40 |

### 2.2 核心计费规则

```
// ===== 计费策略：根据不同费率和用量计算费用 =====
Service BillingService {
    // 月末出账：聚合当月所有使用记录，生成一张账单
    @Invoice generateMonthlyInvoice(@MemberId memberId, @LocalDate billingMonth);
    
    // 按费率计算费用：RatePolicy 策略模式
    // 支持按天/周/月/灵活时长等多种费率
    Money calculateUsageFee(@UsageRecord usage, @RatePolicy ratePolicy);
}

// ===== 超时计费策略 =====
Service OvertimePolicy {
    // 计算会议室超时费
    // 规则：(实际结束时间 - 预订结束时间 - GracePeriod) × 超时费率
    // 如果超时 <= 15分钟，不收费
    Money calculateRoomOvertime(
        @TimeSlot bookedSlot,     // 预订时段：14:00-15:00
        @TimeSlot actualSlot,     // 实际使用时段：14:00-15:45
        @RoomRate rate            // 会议室费率
    );
}

// ===== 免罚期策略 =====
ValueObject GracePeriod {
    Duration duration = 15 minutes
    // 会议室超时 15 分钟内不额外收费
    // 业务意义：给用户缓冲时间，避免因超时几分钟被收费的负面体验
}
```

### 2.3 事件驱动的计费流程

```
Booking 事件流                              Billing 响应
─────────────────                         ─────────────────

BookingCheckedIn                          记录开始时间
    │                                     （计费计时开始）
    ▼
BookingCheckedOut ──────────────────►     recordDeskUsage()
    │                                     计算工位使用费
    ▼
RoomBookingCompleted ───────────────►     recordRoomUsage()
    │                                     计算会议室费 + 超时费
    ▼
FlexSessionEnded ───────────────────►     recordFlexUsage()
    │                                     计算灵活区使用费
    ▼
                                  ┌───────▼────────┐
                                  │  generateMonthlyInvoice()  │
                                  │  聚合当月所有费用            │
                                  │  生成 Invoice               │
                                  │  账单：¥899 + ¥40 = ¥939    │
                                  └────────────────────────────┘
```

### 2.4 计费应用服务

```
Service BillingApplicationService {
    // 监听 Booking 事件，记录每笔费用
    @UsageCharged recordDeskUsage(@UsageRecord usage);
    @UsageCharged recordRoomUsage(@RoomBookingCompleted event);
    @UsageCharged recordFlexUsage(@FlexSessionEnded event);
    
    // 处理支付（对接支付网关）
    @PaymentProcessed processPayment(@PaymentCommand cmd);
}
```

---

## 三、计费场景推演（小张的账单怎么来的）

```
月底账单明细：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MEMBERSHIP_FEE    ¥899    ← 套餐月费（FIXED_DESK 套餐）
  DESK_USAGE        ¥0      ← 固定工位已含在套餐内
  ROOM_USAGE        ¥30     ← 14:00-15:00 会议室正常费率 ¥30/h
  OVER_TIME_PENALTY ¥40     ← 15:00-15:45 超时 45min
                              GracePeriod 免罚 15min
                              实际计费超时 30min × 超时费率 ¥80/h = ¥40
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  总计              ¥939
```

---

## 四、Event Storming 发现的关键业务规则

| 发现 | 建模影响 | 收入影响 |
|------|---------|---------|
| 签到后 **15 分钟**未到自动释放 | `NoShowPolicy` + `ScheduledTask` | 防止资源空占，提升翻台率 |
| 工位可**按天/周/月/灵活时长** | `RatePolicy` 策略模式 | 灵活定价，适配不同客群 |
| 会议室超时 **15 分钟**内不额外收费 | `GracePeriod` 值对象 | 用户体验 vs 收入损失的平衡 |
| 企业会员可为员工统一开卡 | `CorporateAccount` 跨上下文聚合 | B2B 批量收入的入口 |

---

## 五、核心业务的价值闭环

```
                        ┌─────────────┐
                        │   会员付费    │
                        │  ¥899/月     │
                        └──────┬──────┘
                               │
                    ┌──────────▼──────────┐
                    │   Booking 资源预订    │
                    │   • 锁定工位          │
                    │   • 计时会议室        │
                    │   • 管理灵活区会话     │
                    └──────────┬──────────┘
                               │ 使用事件
                    ┌──────────▼──────────┐
                    │   Billing 计费引擎    │
                    │   • 按费率计算        │
                    │   • 超时策略          │
                    │   • 月度出账          │
                    └──────────┬──────────┘
                               │ 账单
                    ┌──────────▼──────────┐
                    │      revenue         │
                    │   💰 收入 = ¥939     │
                    └─────────────────────┘
```

> **一句话总结：** Membership 把人拉进来，Booking 让人用起来，Billing 把钱收回来。Facility、Access、Notification 都是这圈钱的"基础设施"。
