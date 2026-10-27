ALTER TABLE `loan_contracts` ADD `bank_id` int;--> statement-breakpoint
UPDATE `loan_contracts` l
SET l.`bank_id` = (SELECT a.`bank_id` FROM `company_bank_accounts` a WHERE a.`id` = l.`company_bank_account_id`);--> statement-breakpoint
UPDATE `loan_contracts` SET `bank_id` = (SELECT MIN(`id`) FROM `banks`) WHERE `bank_id` IS NULL;--> statement-breakpoint
ALTER TABLE `loan_contracts` MODIFY COLUMN `bank_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `loan_contracts` ADD CONSTRAINT `loan_contracts_bank_id_banks_id_fk` FOREIGN KEY (`bank_id`) REFERENCES `banks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loan_contracts` DROP FOREIGN KEY `loan_contracts_bank_account_fk`;--> statement-breakpoint
ALTER TABLE `loan_contracts` DROP COLUMN `company_bank_account_id`;

--> down

ALTER TABLE `loan_contracts` ADD `company_bank_account_id` int;--> statement-breakpoint
UPDATE `loan_contracts` l
SET l.`company_bank_account_id` = (
  SELECT MIN(a.`id`) FROM `company_bank_accounts` a WHERE a.`bank_id` = l.`bank_id`
)
WHERE l.`company_bank_account_id` IS NULL;--> statement-breakpoint
ALTER TABLE `loan_contracts` ADD CONSTRAINT `loan_contracts_bank_account_fk` FOREIGN KEY (`company_bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loan_contracts` DROP FOREIGN KEY `loan_contracts_bank_id_banks_id_fk`;--> statement-breakpoint
ALTER TABLE `loan_contracts` DROP COLUMN `bank_id`;
