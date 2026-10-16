CREATE TABLE `motorcycle_model_colors` (
	`model_id` int NOT NULL,
	`color_id` int NOT NULL,
	CONSTRAINT `motorcycle_model_colors_model_id_color_id_pk` PRIMARY KEY(`model_id`,`color_id`)
);
--> statement-breakpoint
ALTER TABLE `motorcycle_models` ADD `brand` varchar(100);--> statement-breakpoint
ALTER TABLE `motorcycle_models` ADD `model_year` varchar(20);--> statement-breakpoint
ALTER TABLE `motorcycle_model_colors` ADD CONSTRAINT `motorcycle_model_colors_model_id_motorcycle_models_id_fk` FOREIGN KEY (`model_id`) REFERENCES `motorcycle_models`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `motorcycle_model_colors` ADD CONSTRAINT `motorcycle_model_colors_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE cascade ON UPDATE no action;