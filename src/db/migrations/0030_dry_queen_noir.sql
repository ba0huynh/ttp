ALTER TABLE `motorcycle_models` ADD `color_id` int;--> statement-breakpoint
ALTER TABLE `motorcycle_models` ADD CONSTRAINT `motorcycle_models_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE `motorcycle_models` m SET m.`color_id` = (SELECT v.`color_id` FROM `vehicles` v WHERE v.`model_id` = m.`id` ORDER BY v.`id` LIMIT 1) WHERE m.`color_id` IS NULL;
