ALTER TABLE `banks` DROP INDEX `banks_code_unique`;--> statement-breakpoint
ALTER TABLE `colors` DROP INDEX `colors_code_unique`;--> statement-breakpoint
ALTER TABLE `motorcycle_models` DROP INDEX `motorcycle_models_code_unique`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP INDEX `suppliers_code_unique`;--> statement-breakpoint
ALTER TABLE `banks` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `colors` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `motorcycle_models` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `code`;

--> down

ALTER TABLE `banks` ADD `code` varchar(20);--> statement-breakpoint
ALTER TABLE `banks` ADD CONSTRAINT `banks_code_unique` UNIQUE(`code`);--> statement-breakpoint
ALTER TABLE `colors` ADD `code` varchar(30);--> statement-breakpoint
ALTER TABLE `colors` ADD CONSTRAINT `colors_code_unique` UNIQUE(`code`);--> statement-breakpoint
ALTER TABLE `motorcycle_models` ADD `code` varchar(50);--> statement-breakpoint
ALTER TABLE `motorcycle_models` ADD CONSTRAINT `motorcycle_models_code_unique` UNIQUE(`code`);--> statement-breakpoint
ALTER TABLE `suppliers` ADD `code` varchar(30);--> statement-breakpoint
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_code_unique` UNIQUE(`code`);
