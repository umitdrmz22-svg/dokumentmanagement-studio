CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`company` text NOT NULL,
	`work` text NOT NULL,
	`street` text NOT NULL,
	`house_number` text NOT NULL,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL,
	`access_status` text DEFAULT 'pilot' NOT NULL,
	`terms_version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);--> statement-breakpoint
CREATE TABLE `legal_entries` (
	`run_id` text NOT NULL,
	`law_id` text NOT NULL,
	`payload` text NOT NULL,
	`source_hash` text NOT NULL,
	PRIMARY KEY(`run_id`, `law_id`),
	FOREIGN KEY (`run_id`) REFERENCES `legal_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`account_id` text NOT NULL,
	`law_id` text NOT NULL,
	PRIMARY KEY(`account_id`, `law_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `legal_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`error` text,
	`changed` integer DEFAULT 0 NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_account_idx` ON `sessions` (`account_id`);--> statement-breakpoint
CREATE TABLE `legal_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
