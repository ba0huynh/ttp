ALTER TABLE `sales_order_items` ADD `price_before_vat` decimal(18,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `sales_order_items` ADD `vat_rate` decimal(5,2) NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `sales_order_items` SET `price_before_vat` = `unit_price`;

--> down

ALTER TABLE `sales_order_items` DROP COLUMN `vat_rate`;--> statement-breakpoint
ALTER TABLE `sales_order_items` DROP COLUMN `price_before_vat`;
