ALTER TABLE `batch_expenses` MODIFY COLUMN `expense_type_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `batch_expenses` DROP COLUMN `expense_type`;

--> down

ALTER TABLE `batch_expenses` ADD `expense_type` enum('import_tax','vat_import','shipping_international','shipping_domestic','customs_fee','other');--> statement-breakpoint
ALTER TABLE `batch_expenses` MODIFY COLUMN `expense_type_id` int;
