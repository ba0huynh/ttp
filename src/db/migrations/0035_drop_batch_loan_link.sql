ALTER TABLE `import_batches` DROP FOREIGN KEY `import_batches_loan_contract_id_loan_contracts_id_fk`;
--> statement-breakpoint
DROP INDEX `import_batches_loan_idx` ON `import_batches`;--> statement-breakpoint
ALTER TABLE `import_batches` DROP COLUMN `loan_contract_id`;