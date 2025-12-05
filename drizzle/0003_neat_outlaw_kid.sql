ALTER TABLE `users` ADD `hatena_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_hatena_id_unique` ON `users` (`hatena_id`);