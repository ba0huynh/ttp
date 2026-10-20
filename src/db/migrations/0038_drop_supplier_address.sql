ALTER TABLE `suppliers` DROP COLUMN `address`;

--> down

ALTER TABLE `suppliers` ADD `address` varchar(255);
