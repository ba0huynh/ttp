ALTER TABLE `pos_branches` DROP INDEX `pos_branches_code_unique`;--> statement-breakpoint
ALTER TABLE `pos_branches` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `pos_branches` DROP COLUMN `tax_code`;--> statement-breakpoint
ALTER TABLE `pos_branches` DROP COLUMN `address`;--> statement-breakpoint
ALTER TABLE `pos_branches` DROP COLUMN `phone`;

--> down

ALTER TABLE `pos_branches` ADD `code` varchar(30);--> statement-breakpoint
ALTER TABLE `pos_branches` ADD CONSTRAINT `pos_branches_code_unique` UNIQUE(`code`);--> statement-breakpoint
ALTER TABLE `pos_branches` ADD `tax_code` varchar(30);--> statement-breakpoint
ALTER TABLE `pos_branches` ADD `address` varchar(500);--> statement-breakpoint
ALTER TABLE `pos_branches` ADD `phone` varchar(20);
