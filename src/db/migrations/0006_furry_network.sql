ALTER TABLE `suppliers` DROP COLUMN `country`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `phone`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `contact_person`;

--> down

ALTER TABLE `suppliers` ADD `country` varchar(100);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `contact_person` varchar(150);
