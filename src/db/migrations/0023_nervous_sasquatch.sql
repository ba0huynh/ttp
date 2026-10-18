ALTER TABLE `loan_contracts` ADD `term_months` int DEFAULT 12 NOT NULL;

--> down

ALTER TABLE `loan_contracts` DROP COLUMN `term_months`;
