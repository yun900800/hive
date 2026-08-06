CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`passwordHash` text,
	`role` text DEFAULT 'MEMBER' NOT NULL,
	`memberId` text,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`aggregateId` text NOT NULL,
	`aggregateType` text NOT NULL,
	`eventType` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`createdAt` integer,
	`processedAt` integer
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text NOT NULL,
	`tier` text DEFAULT 'BASIC' NOT NULL,
	`creditScore` integer DEFAULT 100 NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_email_unique` ON `member` (`email`);--> statement-breakpoint
CREATE INDEX `member_email_idx` ON `member` (`email`);--> statement-breakpoint
CREATE TABLE `plan` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`planType` text NOT NULL,
	`monthlyFeeCents` integer NOT NULL,
	`freeFlexHours` integer DEFAULT 0 NOT NULL,
	`description` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `plan_type_idx` ON `plan` (`planType`);--> statement-breakpoint
CREATE TABLE `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`memberId` text NOT NULL,
	`planId` text NOT NULL,
	`planType` text NOT NULL,
	`monthlyFeeCents` integer NOT NULL,
	`startDate` integer NOT NULL,
	`endDate` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`createdAt` integer,
	`updatedAt` integer,
	FOREIGN KEY (`memberId`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subscription_member_idx` ON `subscription` (`memberId`);--> statement-breakpoint
CREATE INDEX `subscription_status_idx` ON `subscription` (`status`);--> statement-breakpoint
CREATE TABLE `desk` (
	`id` text PRIMARY KEY NOT NULL,
	`floor` text NOT NULL,
	`zone` text NOT NULL,
	`deskNumber` text NOT NULL,
	`code` text NOT NULL,
	`type` text DEFAULT 'STANDARD' NOT NULL,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `desk_code_unique` ON `desk` (`code`);--> statement-breakpoint
CREATE INDEX `desk_code_idx` ON `desk` (`code`);--> statement-breakpoint
CREATE TABLE `flex_zone` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`floor` text NOT NULL,
	`capacity` integer NOT NULL,
	`openingTime` text DEFAULT '08:00' NOT NULL,
	`closingTime` text DEFAULT '22:00' NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `zone_status_idx` ON `flex_zone` (`status`);--> statement-breakpoint
CREATE TABLE `gate` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`floor` text NOT NULL,
	`zone` text NOT NULL,
	`type` text DEFAULT 'ENTRY_TURNSTILE' NOT NULL,
	`status` text DEFAULT 'OPERATIONAL' NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `gate_status_idx` ON `gate` (`status`);--> statement-breakpoint
CREATE TABLE `meeting_room` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`equipments` text,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`hourlyRateCents` integer DEFAULT 3000 NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `room_status_idx` ON `meeting_room` (`status`);