ALTER TABLE `customers` DROP INDEX `customers_code_unique`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `code`;

--> down

ALTER TABLE `customers` ADD `code` varchar(30);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_code_unique` UNIQUE(`code`);
