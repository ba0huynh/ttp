CREATE TABLE `expense_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expense_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `batch_expenses` ADD `expense_type_id` int;--> statement-breakpoint
ALTER TABLE `batch_expenses` ADD CONSTRAINT `batch_expenses_expense_type_id_expense_types_id_fk` FOREIGN KEY (`expense_type_id`) REFERENCES `expense_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO `expense_types` (`name`) VALUES ('Thuế nhập khẩu'), ('VAT hàng nhập'), ('Vận chuyển quốc tế'), ('Vận chuyển nội địa'), ('Phí hải quan'), ('Chi phí khác');--> statement-breakpoint
UPDATE `batch_expenses` e JOIN `expense_types` t ON t.`name` = CASE e.`expense_type` WHEN 'import_tax' THEN 'Thuế nhập khẩu' WHEN 'vat_import' THEN 'VAT hàng nhập' WHEN 'shipping_international' THEN 'Vận chuyển quốc tế' WHEN 'shipping_domestic' THEN 'Vận chuyển nội địa' WHEN 'customs_fee' THEN 'Phí hải quan' ELSE 'Chi phí khác' END SET e.`expense_type_id` = t.`id`;

--> down

ALTER TABLE `batch_expenses` DROP FOREIGN KEY `batch_expenses_expense_type_id_expense_types_id_fk`;--> statement-breakpoint
ALTER TABLE `batch_expenses` DROP COLUMN `expense_type_id`;--> statement-breakpoint
DROP TABLE IF EXISTS `expense_types`;
