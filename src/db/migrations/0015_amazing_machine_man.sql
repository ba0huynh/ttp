ALTER TABLE `receipt_vouchers` DROP COLUMN `note`;

--> down

ALTER TABLE `receipt_vouchers` ADD `note` text;
