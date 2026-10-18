ALTER TABLE `customers` DROP COLUMN `address`;

--> down

ALTER TABLE `customers` ADD `address` varchar(500);
