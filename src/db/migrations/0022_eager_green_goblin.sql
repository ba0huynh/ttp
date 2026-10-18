ALTER TABLE `users` MODIFY COLUMN `role_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;

--> down

ALTER TABLE `users` ADD `role` enum('admin','accountant','sales','warehouse') NOT NULL DEFAULT 'warehouse';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role_id` int;
