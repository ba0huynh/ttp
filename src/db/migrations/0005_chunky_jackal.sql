ALTER TABLE `motorcycle_models` DROP COLUMN `brand`;

--> down

ALTER TABLE `motorcycle_models` ADD `brand` varchar(100);
