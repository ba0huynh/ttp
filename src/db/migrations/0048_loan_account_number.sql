ALTER TABLE `loan_contracts` ADD `account_number` varchar(50);
--> down
ALTER TABLE `loan_contracts` DROP COLUMN `account_number`;

