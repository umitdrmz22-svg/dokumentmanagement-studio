CREATE TABLE `access_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`action` text NOT NULL,
	`reference` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer NOT NULL,
	`valid_until` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `access_events_account_idx` ON `access_events` (`account_id`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `license_valid_until` integer;