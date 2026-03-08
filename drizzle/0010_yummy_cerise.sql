PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text,
	`query` text,
	`title` text,
	`messages` text DEFAULT '[]' NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`last_message_preview` text,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chat_threads`("id", "user_id", "url", "query", "title", "messages", "message_count", "last_message_preview", "created_at", "updated_at") SELECT "id", "user_id", "url", "query", "title", "messages", "message_count", "last_message_preview", "created_at", "updated_at" FROM `chat_threads`;--> statement-breakpoint
DROP TABLE `chat_threads`;--> statement-breakpoint
ALTER TABLE `__new_chat_threads` RENAME TO `chat_threads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;