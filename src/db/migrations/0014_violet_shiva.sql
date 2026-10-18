ALTER TABLE `payment_vouchers` DROP INDEX `payment_vouchers_voucher_number_unique`;--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP FOREIGN KEY `payment_vouchers_batch_id_import_batches_id_fk`;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP COLUMN `voucher_number`;--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP COLUMN `batch_id`;--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP COLUMN `method`;

--> down

ALTER TABLE `payment_vouchers` ADD `voucher_number` varchar(50);--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_voucher_number_unique` UNIQUE(`voucher_number`);--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD `batch_id` int;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_batch_id_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD `method` enum('cash','bank_transfer') NOT NULL DEFAULT 'bank_transfer';
