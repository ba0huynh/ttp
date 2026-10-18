ALTER TABLE `import_batches` MODIFY COLUMN `supplier_id` int;

--> down

ALTER TABLE `import_batches` MODIFY COLUMN `supplier_id` int NOT NULL;
