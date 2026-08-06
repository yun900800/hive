/**
 * Billing 订阅者启动引导 —— 进程内只注册一次。
 * 服务端路由 / server actions / 脚本导入本模块即完成事件接线。
 */

import { registerBillingSubscribers } from "./billing-subscribers";

registerBillingSubscribers();
