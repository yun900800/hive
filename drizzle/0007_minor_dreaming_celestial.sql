CREATE TABLE `resource_lock` (
	`resourceId` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `user` ADD `sessionVersion` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `outbox_event` ADD `lastError` text;--> statement-breakpoint
ALTER TABLE `outbox_event` ADD `nextAttemptAt` integer;--> statement-breakpoint
ALTER TABLE `outbox_event` ADD `lockedAt` integer;--> statement-breakpoint
CREATE INDEX `outbox_event_status_idx` ON `outbox_event` (`status`,`id`);--> statement-breakpoint
-- 注：`invoice_line_item.occurredAt` 已由手写的 0006 迁移添加（该迁移没有 snapshot，
-- 所以 drizzle-kit 在本文件里重复生成了 ALTER）。此处删除以避免 duplicate column。
-- 0007 的 snapshot 已包含该列，后续 diff 不受影响。
CREATE UNIQUE INDEX `flex_session_active_member_idx` ON `flex_session` (`memberId`) WHERE "flex_session"."status" = 'ACTIVE';