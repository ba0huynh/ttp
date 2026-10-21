DELETE FROM `banks`
WHERE (`code` IS NULL OR BINARY `code` NOT IN ('ACB', 'VCCB', 'VCB', 'HDB', 'EIB'))
  AND NOT EXISTS (SELECT 1 FROM `company_bank_accounts` a WHERE a.`bank_id` = `banks`.`id`);

--> down

SELECT 1;
