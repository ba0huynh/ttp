ALTER TABLE `motorcycle_models` DROP COLUMN `engine_capacity`;

--> down

ALTER TABLE `motorcycle_models` ADD `engine_capacity` int;
