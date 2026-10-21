ALTER TABLE `loan_contracts` ADD `account_number` varchar(50);--> statement-breakpoint
ALTER TABLE `import_batches` ADD `loan_contract_id` int;--> statement-breakpoint
CREATE INDEX `import_batches_loan_idx` ON `import_batches` (`loan_contract_id`);--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_loan_contract_id_loan_contracts_id_fk` FOREIGN KEY (`loan_contract_id`) REFERENCES `loan_contracts`(`id`) ON DELETE set null ON UPDATE no action;

--> down

ALTER TABLE `import_batches` DROP FOREIGN KEY `import_batches_loan_contract_id_loan_contracts_id_fk`;
--> statement-breakpoint
DROP INDEX `import_batches_loan_idx` ON `import_batches`;--> statement-breakpoint
ALTER TABLE `import_batches` DROP COLUMN `loan_contract_id`;--> statement-breakpoint
ALTER TABLE `loan_contracts` DROP COLUMN `account_number`;
