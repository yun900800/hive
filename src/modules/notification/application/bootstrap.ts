/**
 * 支撑上下文订阅者启动引导 —— Access + Notification。
 * 服务端路由 / server actions / 脚本导入本模块即完成事件接线。
 */

import { registerAccessSubscribers } from "../../access/application/access-subscribers";
import { registerNotificationSubscribers } from "./notification-subscribers";

registerAccessSubscribers();
registerNotificationSubscribers();
