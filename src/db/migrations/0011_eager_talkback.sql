ALTER TABLE `bank_statement_lines` DROP COLUMN `reference`;

--> down

ALTER TABLE `bank_statement_lines` ADD `reference` varchar(100);
