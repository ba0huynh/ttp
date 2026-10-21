DELETE FROM `banks`
WHERE NOT (
    `code` IN ('ACB', 'VCCB', 'VCB', 'HDB', 'EIB')
    OR `name` LIKE '%Á Châu%'
    OR `name` LIKE '%Bản Việt%'
    OR `name` LIKE '%Ngoại Thương%'
    OR `name` LIKE '%Phát triển Thành phố Hồ Chí Minh%'
    OR `name` LIKE '%Xuất Nhập khẩu%'
  )
  AND NOT EXISTS (SELECT 1 FROM `loan_contracts` l WHERE l.`bank_id` = `banks`.`id`)
  AND NOT EXISTS (SELECT 1 FROM `company_bank_accounts` a WHERE a.`bank_id` = `banks`.`id`);

--> down

SELECT 1;
