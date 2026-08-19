DROP INDEX `invoice_member_month_idx`;--> statement-breakpoint
CREATE INDEX `invoice_member_month_idx` ON `invoice` (`memberId`,`billingMonth`);--> statement-breakpoint
ALTER TABLE `invoice_line_item` ADD `referenceId` text;--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_active_member_idx` ON `subscription` (`memberId`) WHERE "subscription"."status" = 'ACTIVE';