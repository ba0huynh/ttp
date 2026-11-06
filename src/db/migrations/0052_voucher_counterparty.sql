ALTER TABLE `receipt_vouchers` MODIFY COLUMN `customer_id` int NULL;
--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD `supplier_id` int;
--> statement-breakpoint
CREATE INDEX `receipt_vouchers_supplier_idx` ON `receipt_vouchers` (`supplier_id`);
--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD CONSTRAINT `receipt_vouchers_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` MODIFY COLUMN `payee_type` enum('supplier','other','customer') NOT NULL DEFAULT 'supplier';
--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD `customer_id` int;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD `branch_id` int;
--> statement-breakpoint
CREATE INDEX `payment_vouchers_customer_idx` ON `payment_vouchers` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `payment_vouchers_branch_idx` ON `payment_vouchers` (`branch_id`);
--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_branch_id_pos_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `pos_branches`(`id`) ON DELETE no action ON UPDATE no action;
--> down
DELETE FROM `receipt_vouchers` WHERE `customer_id` IS NULL;
--> statement-breakpoint
DELETE FROM `payment_vouchers` WHERE `payee_type` = 'customer';
--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP FOREIGN KEY `payment_vouchers_branch_id_pos_branches_id_fk`;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP FOREIGN KEY `payment_vouchers_customer_id_customers_id_fk`;
--> statement-breakpoint
DROP INDEX `payment_vouchers_branch_idx` ON `payment_vouchers`;
--> statement-breakpoint
DROP INDEX `payment_vouchers_customer_idx` ON `payment_vouchers`;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP COLUMN `branch_id`;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP COLUMN `customer_id`;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` MODIFY COLUMN `payee_type` enum('supplier','other') NOT NULL DEFAULT 'supplier';
--> statement-breakpoint
ALTER TABLE `receipt_vouchers` DROP FOREIGN KEY `receipt_vouchers_supplier_id_suppliers_id_fk`;
--> statement-breakpoint
DROP INDEX `receipt_vouchers_supplier_idx` ON `receipt_vouchers`;
--> statement-breakpoint
ALTER TABLE `receipt_vouchers` DROP COLUMN `supplier_id`;
--> statement-breakpoint
ALTER TABLE `receipt_vouchers` MODIFY COLUMN `customer_id` int NOT NULL;
