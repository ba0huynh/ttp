-- The selling price is always import price + margin (batch expenses are not part of it).
-- Switch every existing batch to that base and re-price its vehicles.
UPDATE `vehicles` v JOIN `import_batches` b ON b.`id` = v.`batch_id` SET v.`selling_price` = ROUND(CASE b.`pricing_method` WHEN 'percent' THEN v.`import_price` * (1 + b.`pricing_value` / 100) ELSE v.`import_price` + b.`pricing_value` END);--> statement-breakpoint
UPDATE `import_batches` SET `pricing_base` = 'import_price';

--> down

UPDATE `import_batches` SET `pricing_base` = 'cost_price';
