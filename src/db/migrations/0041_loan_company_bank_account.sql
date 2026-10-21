ALTER TABLE `loan_contracts` DROP COLUMN `account_number`;--> statement-breakpoint
ALTER TABLE `loan_contracts` ADD `company_bank_account_id` int;--> statement-breakpoint
ALTER TABLE `loan_contracts` ADD CONSTRAINT `loan_contracts_bank_account_fk` FOREIGN KEY (`company_bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE no action ON UPDATE no action;

--> down

ALTER TABLE `loan_contracts` DROP FOREIGN KEY `loan_contracts_bank_account_fk`;
--> statement-breakpoint
ALTER TABLE `loan_contracts` DROP COLUMN `company_bank_account_id`;--> statement-breakpoint
ALTER TABLE `loan_contracts` ADD `account_number` varchar(50);
