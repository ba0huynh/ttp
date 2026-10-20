ALTER TABLE `suppliers` ADD `image` varchar(500);

--> down

ALTER TABLE `suppliers` DROP COLUMN `image`;
