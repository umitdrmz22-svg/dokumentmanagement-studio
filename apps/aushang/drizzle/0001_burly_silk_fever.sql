CREATE TABLE `device_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`message` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `challenges_expiry_idx` ON `device_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`public_key` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `devices_account_idx` ON `devices` (`account_id`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `device_id` text REFERENCES devices(id);