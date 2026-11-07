CREATE TABLE `site_notices` (
	`account_id` text PRIMARY KEY NOT NULL,
	`draft` text DEFAULT '{}' NOT NULL,
	`published` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
