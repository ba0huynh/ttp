ALTER TABLE `receipt_vouchers` DROP INDEX `receipt_vouchers_voucher_number_unique`;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` DROP COLUMN `voucher_number`;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` DROP COLUMN `method`;