ALTER TABLE `import_batches` DROP INDEX `import_batches_batch_code_unique`;--> statement-breakpoint
ALTER TABLE `import_batches` DROP COLUMN `batch_code`;--> statement-breakpoint
ALTER TABLE `import_batches` DROP COLUMN `customs_declaration_no`;