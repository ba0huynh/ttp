ALTER TABLE `motorcycle_models` DROP FOREIGN KEY `motorcycle_models_color_id_colors_id_fk`;
--> statement-breakpoint
ALTER TABLE `motorcycle_models` DROP COLUMN `color_id`;

--> down

ALTER TABLE `motorcycle_models` ADD `color_id` int;--> statement-breakpoint
ALTER TABLE `motorcycle_models` ADD CONSTRAINT `motorcycle_models_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE no action ON UPDATE no action;
