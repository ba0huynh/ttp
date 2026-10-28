ALTER TABLE `vehicles` ADD `vat_rate` decimal(5,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `import_price_with_vat` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `vehicles` SET `import_price_with_vat` = `import_price` WHERE `import_price_with_vat` = 0;--> statement-breakpoint
ALTER TABLE `vehicles` ALTER COLUMN `vat_rate` SET DEFAULT 10;
--> down
ALTER TABLE `vehicles` DROP COLUMN `import_price_with_vat`;--> statement-breakpoint
ALTER TABLE `vehicles` DROP COLUMN `vat_rate`;

