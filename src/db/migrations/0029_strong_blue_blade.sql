ALTER TABLE `pos_branches` ADD `address` varchar(500);

--> down

ALTER TABLE `pos_branches` DROP COLUMN `address`;
