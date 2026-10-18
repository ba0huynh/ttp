ALTER TABLE `loan_contracts` DROP COLUMN `maturity_date`;--> statement-breakpoint
ALTER TABLE `loan_contracts` DROP COLUMN `status`;

--> down

ALTER TABLE `loan_contracts` ADD `maturity_date` date;--> statement-breakpoint
ALTER TABLE `loan_contracts` ADD `status` enum('active','settled') NOT NULL DEFAULT 'active';
