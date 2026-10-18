ALTER TABLE `customers` DROP COLUMN `tax_code`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `phone`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `contact_person`;

--> down

ALTER TABLE `customers` ADD `tax_code` varchar(30);--> statement-breakpoint
ALTER TABLE `customers` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `customers` ADD `contact_person` varchar(150);
