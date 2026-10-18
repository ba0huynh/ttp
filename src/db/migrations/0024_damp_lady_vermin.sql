ALTER TABLE `banks` ADD `code` varchar(20);--> statement-breakpoint
ALTER TABLE `banks` ADD `short_name` varchar(100);

--> down

ALTER TABLE `banks` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `banks` DROP COLUMN `short_name`;
