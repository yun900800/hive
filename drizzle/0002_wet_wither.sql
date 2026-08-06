CREATE TABLE `invoice_line_item` (
	`id` text PRIMARY KEY NOT NULL,
	`invoiceId` text NOT NULL,
	`chargeType` text NOT NULL,
	`description` text NOT NULL,
	`amountCents` integer NOT NULL,
	FOREIGN KEY (`invoiceId`) REFERENCES `invoice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_line_invoice_idx` ON `invoice_line_item` (`invoiceId`);--> statement-breakpoint
CREATE TABLE `invoice` (
	`id` text PRIMARY KEY NOT NULL,
	`memberId` text NOT NULL,
	`billingMonth` text NOT NULL,
	`totalCents` integer NOT NULL,
	`discountRate` integer DEFAULT 100 NOT NULL,
	`discountAppliedCents` integer DEFAULT 0 NOT NULL,
	`paidAmountCents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`dueDate` integer NOT NULL,
	`paidAt` integer,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `invoice_member_idx` ON `invoice` (`memberId`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_member_month_idx` ON `invoice` (`memberId`,`billingMonth`);--> statement-breakpoint
CREATE TABLE `usage_record` (
	`id` text PRIMARY KEY NOT NULL,
	`memberId` text NOT NULL,
	`chargeType` text NOT NULL,
	`description` text NOT NULL,
	`referenceId` text NOT NULL,
	`durationMs` integer DEFAULT 0 NOT NULL,
	`unitRateCents` integer DEFAULT 0 NOT NULL,
	`amountCents` integer NOT NULL,
	`occurredAt` integer NOT NULL,
	`billingMonth` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_record_member_idx` ON `usage_record` (`memberId`);--> statement-breakpoint
CREATE INDEX `usage_record_month_idx` ON `usage_record` (`memberId`,`billingMonth`);--> statement-breakpoint
CREATE UNIQUE INDEX `usage_record_ref_idx` ON `usage_record` (`chargeType`,`referenceId`);