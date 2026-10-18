ALTER TABLE `receipt_vouchers` DROP INDEX `receipt_vouchers_voucher_number_unique`;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` DROP COLUMN `voucher_number`;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` DROP COLUMN `method`;

--> down

ALTER TABLE `receipt_vouchers` ADD `voucher_number` varchar(50);--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD CONSTRAINT `receipt_vouchers_voucher_number_unique` UNIQUE(`voucher_number`);--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD `method` enum('cash','bank_transfer') NOT NULL DEFAULT 'bank_transfer';
