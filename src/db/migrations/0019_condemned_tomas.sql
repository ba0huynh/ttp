ALTER TABLE `sales_orders` DROP COLUMN `note`;

--> down

ALTER TABLE `sales_orders` ADD `note` text;
