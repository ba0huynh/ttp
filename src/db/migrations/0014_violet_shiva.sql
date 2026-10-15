ALTER TABLE `payment_vouchers` DROP INDEX `payment_vouchers_voucher_number_unique`;--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP FOREIGN KEY `payment_vouchers_batch_id_import_batches_id_fk`;
--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP COLUMN `voucher_number`;--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP COLUMN `batch_id`;--> statement-breakpoint
ALTER TABLE `payment_vouchers` DROP COLUMN `method`;