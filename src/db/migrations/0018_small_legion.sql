ALTER TABLE `sales_orders` DROP INDEX `sales_orders_order_number_unique`;--> statement-breakpoint
ALTER TABLE `sales_orders` DROP COLUMN `order_number`;

--> down

ALTER TABLE `sales_orders` ADD `order_number` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_order_number_unique` UNIQUE(`order_number`);
