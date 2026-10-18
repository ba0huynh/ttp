ALTER TABLE `banks` ADD `image` varchar(500);

--> down

ALTER TABLE `banks` DROP COLUMN `image`;
