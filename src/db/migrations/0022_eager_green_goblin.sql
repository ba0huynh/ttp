ALTER TABLE `users` MODIFY COLUMN `role_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;