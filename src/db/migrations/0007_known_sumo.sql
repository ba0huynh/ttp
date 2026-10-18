ALTER TABLE `banks` DROP COLUMN `short_name`;

--> down

ALTER TABLE `banks` ADD `short_name` varchar(100);
