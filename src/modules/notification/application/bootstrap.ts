/**
 * Notification 订阅者启动引导 —— 进程内只注册一次。
 * 服务端路由 / server actions / 脚本导入本模块即完成事件接线。
 * 注意：Access 的订阅者注册在 `modules/access/application/bootstrap.ts`，请显式导入，勿在此混合。
 */

import { registerNotificationSubscribers } from "./notification-subscribers";

registerNotificationSubscribers();
