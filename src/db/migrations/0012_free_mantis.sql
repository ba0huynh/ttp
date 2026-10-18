ALTER TABLE `bank_statements` DROP COLUMN `period_from`;--> statement-breakpoint
ALTER TABLE `bank_statements` DROP COLUMN `period_to`;--> statement-breakpoint
ALTER TABLE `bank_statements` DROP COLUMN `note`;

--> down

ALTER TABLE `bank_statements` ADD `period_from` date;--> statement-breakpoint
ALTER TABLE `bank_statements` ADD `period_to` date;--> statement-breakpoint
ALTER TABLE `bank_statements` ADD `note` text;
