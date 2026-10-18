ALTER TABLE `loan_contracts` DROP COLUMN `note`;

--> down

ALTER TABLE `loan_contracts` ADD `note` text;
