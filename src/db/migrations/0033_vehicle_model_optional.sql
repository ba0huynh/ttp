ALTER TABLE `vehicles` MODIFY COLUMN `model_id` int;

--> down

ALTER TABLE `vehicles` MODIFY COLUMN `model_id` int NOT NULL;
