CREATE TABLE `access_log` (
	`id` text PRIMARY KEY NOT NULL,
	`gatePassId` text NOT NULL,
	`memberId` text NOT NULL,
	`gateName` text NOT NULL,
	`direction` text NOT NULL,
	`result` text NOT NULL,
	`accessTime` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_log_member_idx` ON `access_log` (`memberId`);--> statement-breakpoint
CREATE INDEX `access_log_time_idx` ON `access_log` (`accessTime`);--> statement-breakpoint
CREATE INDEX `access_log_result_idx` ON `access_log` (`result`);--> statement-breakpoint
CREATE TABLE `gate_pass` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`memberId` text NOT NULL,
	`bookingId` text NOT NULL,
	`gatePassType` text NOT NULL,
	`validFrom` integer NOT NULL,
	`validTo` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`createdAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gate_pass_code_unique` ON `gate_pass` (`code`);--> statement-breakpoint
CREATE INDEX `gate_pass_member_idx` ON `gate_pass` (`memberId`);--> statement-breakpoint
CREATE INDEX `gate_pass_booking_idx` ON `gate_pass` (`bookingId`);--> statement-breakpoint
CREATE INDEX `gate_pass_status_idx` ON `gate_pass` (`status`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`memberId` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`channel` text DEFAULT 'IN_APP' NOT NULL,
	`status` text DEFAULT 'SENT' NOT NULL,
	`createdAt` integer
);
--> statement-breakpoint
CREATE INDEX `notification_member_idx` ON `notification` (`memberId`);