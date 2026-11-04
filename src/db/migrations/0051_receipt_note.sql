ALTER TABLE `receipt_vouchers` ADD `note` varchar(255);
--> down
ALTER TABLE `receipt_vouchers` DROP COLUMN `note`;
