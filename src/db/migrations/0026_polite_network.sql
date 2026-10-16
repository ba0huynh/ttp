ALTER TABLE `batch_expenses` MODIFY COLUMN `expense_type_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `batch_expenses` DROP COLUMN `expense_type`;