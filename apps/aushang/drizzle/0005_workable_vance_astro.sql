CREATE TABLE `bv_links` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`version` text DEFAULT '' NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bv_links_account_idx` ON `bv_links` (`account_id`);--> statement-breakpoint
CREATE TABLE `bv_settings` (
	`account_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `license_permanent` integer DEFAULT 0 NOT NULL;