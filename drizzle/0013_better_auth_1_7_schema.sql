ALTER TABLE `accounts` ADD `access_token_expires_at` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `refresh_token_expires_at` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `scope` text;--> statement-breakpoint
CREATE TABLE `__new_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_verifications`("id", "identifier", "value", "expires_at", "created_at", "updated_at") SELECT "id", "identifier", "value", "expires_at", "created_at", "created_at" FROM `verifications`;--> statement-breakpoint
DROP TABLE `verifications`;--> statement-breakpoint
ALTER TABLE `__new_verifications` RENAME TO `verifications`;