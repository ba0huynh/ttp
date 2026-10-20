ALTER TABLE `motorcycle_models` DROP COLUMN `model_year`;

--> down

ALTER TABLE `motorcycle_models` ADD `model_year` varchar(20);
