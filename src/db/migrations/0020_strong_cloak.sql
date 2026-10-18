ALTER TABLE `import_batches` DROP INDEX `import_batches_batch_code_unique`;--> statement-breakpoint
ALTER TABLE `import_batches` DROP COLUMN `batch_code`;--> statement-breakpoint
ALTER TABLE `import_batches` DROP COLUMN `customs_declaration_no`;

--> down

ALTER TABLE `import_batches` ADD `batch_code` varchar(50);--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_batch_code_unique` UNIQUE(`batch_code`);--> statement-breakpoint
ALTER TABLE `import_batches` ADD `customs_declaration_no` varchar(50);
