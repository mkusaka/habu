PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_hatena_tokens` (
	`hatena_id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`access_token_secret` text NOT NULL,
	`scope` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_hatena_tokens`("hatena_id", "access_token", "access_token_secret", "scope", "created_at", "updated_at") SELECT "hatena_id", "access_token", "access_token_secret", "scope", "created_at", "updated_at" FROM `hatena_tokens`;--> statement-breakpoint
DROP TABLE `hatena_tokens`;--> statement-breakpoint
ALTER TABLE `__new_hatena_tokens` RENAME TO `hatena_tokens`;--> statement-breakpoint
PRAGMA foreign_keys=ON;