ALTER TABLE `banks` DROP INDEX `banks_code_unique`;--> statement-breakpoint
ALTER TABLE `colors` DROP INDEX `colors_code_unique`;--> statement-breakpoint
ALTER TABLE `motorcycle_models` DROP INDEX `motorcycle_models_code_unique`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP INDEX `suppliers_code_unique`;--> statement-breakpoint
ALTER TABLE `banks` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `colors` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `motorcycle_models` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `code`;