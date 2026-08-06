CREATE TABLE `desk_booking` (
	`id` text PRIMARY KEY NOT NULL,
	`memberId` text NOT NULL,
	`deskId` text NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`checkedInAt` integer,
	`checkedOutAt` integer,
	`cancelledAt` integer,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `desk_booking_resource_idx` ON `desk_booking` (`deskId`,`startTime`);--> statement-breakpoint
CREATE INDEX `desk_booking_member_idx` ON `desk_booking` (`memberId`);--> statement-breakpoint
CREATE INDEX `desk_booking_status_idx` ON `desk_booking` (`status`);--> statement-breakpoint
CREATE TABLE `flex_session` (
	`id` text PRIMARY KEY NOT NULL,
	`memberId` text NOT NULL,
	`zoneId` text NOT NULL,
	`checkInAt` integer NOT NULL,
	`checkOutAt` integer,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `flex_session_member_idx` ON `flex_session` (`memberId`);--> statement-breakpoint
CREATE INDEX `flex_session_zone_idx` ON `flex_session` (`zoneId`);--> statement-breakpoint
CREATE INDEX `flex_session_status_idx` ON `flex_session` (`status`);--> statement-breakpoint
CREATE TABLE `room_booking` (
	`id` text PRIMARY KEY NOT NULL,
	`memberId` text NOT NULL,
	`roomId` text NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer NOT NULL,
	`expectedAttendees` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`startedAt` integer,
	`completedAt` integer,
	`cancelledAt` integer,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `room_booking_resource_idx` ON `room_booking` (`roomId`,`startTime`);--> statement-breakpoint
CREATE INDEX `room_booking_member_idx` ON `room_booking` (`memberId`);--> statement-breakpoint
CREATE INDEX `room_booking_status_idx` ON `room_booking` (`status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_account` (
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
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_account`("userId", "type", "provider", "providerAccountId", "refresh_token", "access_token", "expires_at", "token_type", "scope", "id_token", "session_state") SELECT "userId", "type", "provider", "providerAccountId", "refresh_token", "access_token", "expires_at", "token_type", "scope", "id_token", "session_state" FROM `account`;--> statement-breakpoint
DROP TABLE `account`;--> statement-breakpoint
ALTER TABLE `__new_account` RENAME TO `account`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
INSERT INTO `__new_verificationToken`("identifier", "token", "expires") SELECT "identifier", "token", "expires" FROM `verificationToken`;--> statement-breakpoint
DROP TABLE `verificationToken`;--> statement-breakpoint
ALTER TABLE `__new_verificationToken` RENAME TO `verificationToken`;