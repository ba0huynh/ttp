CREATE TABLE `bank_statement_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`statement_id` int NOT NULL,
	`transaction_date` date NOT NULL,
	`reference` varchar(100),
	`description` varchar(500),
	`debit` decimal(18,2) NOT NULL DEFAULT 0,
	`credit` decimal(18,2) NOT NULL DEFAULT 0,
	`balance` decimal(18,2),
	`status` enum('unmatched','matched','ignored') NOT NULL DEFAULT 'unmatched',
	`matched_type` enum('receipt','payment','loan_repayment'),
	`matched_id` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_statement_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_statements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company_bank_account_id` int NOT NULL,
	`period_from` date NOT NULL,
	`period_to` date NOT NULL,
	`file_name` varchar(255),
	`note` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_statements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `banks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`short_name` varchar(50) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banks_id` PRIMARY KEY(`id`),
	CONSTRAINT `banks_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `batch_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batch_id` int NOT NULL,
	`expense_type` enum('import_tax','vat_import','shipping_international','shipping_domestic','customs_fee','other') NOT NULL,
	`description` varchar(255),
	`amount` decimal(18,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `colors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(30) NOT NULL,
	`name` varchar(80) NOT NULL,
	`hex` varchar(7),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `colors_id` PRIMARY KEY(`id`),
	CONSTRAINT `colors_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `company_bank_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bank_id` int NOT NULL,
	`account_number` varchar(50) NOT NULL,
	`account_name` varchar(255) NOT NULL,
	`branch` varchar(150),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_bank_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_bank_accounts_account_number_unique` UNIQUE(`account_number`)
);
--> statement-breakpoint
CREATE TABLE `company_info` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`tax_code` varchar(20) NOT NULL,
	`address` varchar(255) NOT NULL,
	`phone` varchar(30),
	`email` varchar(191),
	`representative` varchar(150),
	`website` varchar(191),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_info_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(30) NOT NULL,
	`name` varchar(255) NOT NULL,
	`tax_code` varchar(20),
	`address` varchar(255),
	`phone` varchar(30),
	`email` varchar(191),
	`contact_person` varchar(150),
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `delivery_note_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`delivery_note_id` int NOT NULL,
	`vehicle_id` int NOT NULL,
	CONSTRAINT `delivery_note_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_note_items_vehicle_uq` UNIQUE(`vehicle_id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`note_number` varchar(50) NOT NULL,
	`sales_order_id` int NOT NULL,
	`delivery_date` date NOT NULL,
	`receiver_name` varchar(150),
	`transport_info` varchar(255),
	`note` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_notes_note_number_unique` UNIQUE(`note_number`)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batch_code` varchar(50) NOT NULL,
	`supplier_id` int NOT NULL,
	`loan_contract_id` int,
	`import_date` date NOT NULL,
	`customs_declaration_no` varchar(50),
	`pricing_base` enum('import_price','cost_price') NOT NULL DEFAULT 'cost_price',
	`pricing_method` enum('percent','fixed_amount') NOT NULL DEFAULT 'percent',
	`pricing_value` decimal(18,2) NOT NULL DEFAULT 0,
	`note` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `import_batches_batch_code_unique` UNIQUE(`batch_code`)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_id` int NOT NULL,
	`vehicle_id` int NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_items_vehicle_uq` UNIQUE(`vehicle_id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoice_number` varchar(50) NOT NULL,
	`sales_order_id` int NOT NULL,
	`invoice_date` date NOT NULL,
	`branch_id` int,
	`total_amount` decimal(18,2) NOT NULL,
	`note` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoice_number_unique` UNIQUE(`invoice_number`)
);
--> statement-breakpoint
CREATE TABLE `loan_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contract_number` varchar(50) NOT NULL,
	`bank_id` int NOT NULL,
	`principal_amount` decimal(18,2) NOT NULL,
	`interest_rate` decimal(6,3) NOT NULL,
	`disbursement_date` date NOT NULL,
	`maturity_date` date NOT NULL,
	`status` enum('active','settled') NOT NULL DEFAULT 'active',
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loan_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `loan_contracts_contract_number_unique` UNIQUE(`contract_number`)
);
--> statement-breakpoint
CREATE TABLE `loan_repayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loan_contract_id` int NOT NULL,
	`payment_date` date NOT NULL,
	`principal_amount` decimal(18,2) NOT NULL DEFAULT 0,
	`interest_amount` decimal(18,2) NOT NULL DEFAULT 0,
	`company_bank_account_id` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loan_repayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `motorcycle_models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(30) NOT NULL,
	`name` varchar(150) NOT NULL,
	`brand` varchar(80) NOT NULL,
	`engine_capacity` int,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `motorcycle_models_id` PRIMARY KEY(`id`),
	CONSTRAINT `motorcycle_models_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `payment_vouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voucher_number` varchar(50) NOT NULL,
	`payment_date` date NOT NULL,
	`payee_type` enum('supplier','other') NOT NULL DEFAULT 'supplier',
	`supplier_id` int,
	`batch_id` int,
	`payee_name` varchar(255),
	`amount` decimal(18,2) NOT NULL,
	`method` enum('cash','bank_transfer') NOT NULL DEFAULT 'bank_transfer',
	`company_bank_account_id` int,
	`description` varchar(255),
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_vouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_vouchers_voucher_number_unique` UNIQUE(`voucher_number`)
);
--> statement-breakpoint
CREATE TABLE `pos_branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`code` varchar(30) NOT NULL,
	`name` varchar(255) NOT NULL,
	`tax_code` varchar(20),
	`address` varchar(255),
	`phone` varchar(30),
	`contact_person` varchar(150),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pos_branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `pos_branches_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `receipt_vouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voucher_number` varchar(50) NOT NULL,
	`receipt_date` date NOT NULL,
	`customer_id` int NOT NULL,
	`branch_id` int,
	`sales_order_id` int,
	`amount` decimal(18,2) NOT NULL,
	`method` enum('cash','bank_transfer') NOT NULL DEFAULT 'bank_transfer',
	`company_bank_account_id` int,
	`note` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receipt_vouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipt_vouchers_voucher_number_unique` UNIQUE(`voucher_number`)
);
--> statement-breakpoint
CREATE TABLE `sales_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sales_order_id` int NOT NULL,
	`vehicle_id` int NOT NULL,
	`unit_price` decimal(18,2) NOT NULL,
	`cost_price` decimal(18,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sales_order_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_order_items_vehicle_uq` UNIQUE(`vehicle_id`)
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_number` varchar(50) NOT NULL,
	`order_date` date NOT NULL,
	`customer_id` int NOT NULL,
	`branch_id` int,
	`status` enum('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
	`total_amount` decimal(18,2) NOT NULL DEFAULT 0,
	`note` text,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(30) NOT NULL,
	`name` varchar(255) NOT NULL,
	`country` varchar(80),
	`tax_code` varchar(30),
	`address` varchar(255),
	`phone` varchar(30),
	`email` varchar(191),
	`contact_person` varchar(150),
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppliers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(50) NOT NULL,
	`email` varchar(191) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`full_name` varchar(150) NOT NULL,
	`phone` varchar(20),
	`role` enum('admin','accountant','sales','warehouse') NOT NULL DEFAULT 'sales',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batch_id` int NOT NULL,
	`model_id` int NOT NULL,
	`color_id` int NOT NULL,
	`chassis_number` varchar(50) NOT NULL,
	`engine_number` varchar(50) NOT NULL,
	`import_price` decimal(18,2) NOT NULL,
	`allocated_expense` decimal(18,2) NOT NULL DEFAULT 0,
	`cost_price` decimal(18,2) NOT NULL DEFAULT 0,
	`selling_price` decimal(18,2) NOT NULL DEFAULT 0,
	`is_delivered` boolean NOT NULL DEFAULT false,
	`delivered_at` date,
	`is_invoiced` boolean NOT NULL DEFAULT false,
	`invoiced_at` date,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicles_chassis_number_unique` UNIQUE(`chassis_number`),
	CONSTRAINT `vehicles_engine_number_unique` UNIQUE(`engine_number`)
);
--> statement-breakpoint
ALTER TABLE `bank_statement_lines` ADD CONSTRAINT `bank_statement_lines_statement_id_bank_statements_id_fk` FOREIGN KEY (`statement_id`) REFERENCES `bank_statements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statements` ADD CONSTRAINT `bank_statements_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_statements` ADD CONSTRAINT `bank_statements_bank_account_fk` FOREIGN KEY (`company_bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_expenses` ADD CONSTRAINT `batch_expenses_batch_id_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_bank_accounts` ADD CONSTRAINT `company_bank_accounts_bank_id_banks_id_fk` FOREIGN KEY (`bank_id`) REFERENCES `banks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_note_items` ADD CONSTRAINT `delivery_note_items_delivery_note_id_delivery_notes_id_fk` FOREIGN KEY (`delivery_note_id`) REFERENCES `delivery_notes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_note_items` ADD CONSTRAINT `delivery_note_items_vehicle_id_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_notes` ADD CONSTRAINT `delivery_notes_sales_order_id_sales_orders_id_fk` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `delivery_notes` ADD CONSTRAINT `delivery_notes_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_loan_contract_id_loan_contracts_id_fk` FOREIGN KEY (`loan_contract_id`) REFERENCES `loan_contracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_vehicle_id_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_sales_order_id_sales_orders_id_fk` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_branch_id_pos_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `pos_branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loan_contracts` ADD CONSTRAINT `loan_contracts_bank_id_banks_id_fk` FOREIGN KEY (`bank_id`) REFERENCES `banks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loan_repayments` ADD CONSTRAINT `loan_repayments_loan_contract_id_loan_contracts_id_fk` FOREIGN KEY (`loan_contract_id`) REFERENCES `loan_contracts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `loan_repayments` ADD CONSTRAINT `loan_repayments_bank_account_fk` FOREIGN KEY (`company_bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_batch_id_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_bank_account_fk` FOREIGN KEY (`company_bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_branches` ADD CONSTRAINT `pos_branches_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD CONSTRAINT `receipt_vouchers_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD CONSTRAINT `receipt_vouchers_branch_id_pos_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `pos_branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD CONSTRAINT `receipt_vouchers_sales_order_id_sales_orders_id_fk` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD CONSTRAINT `receipt_vouchers_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipt_vouchers` ADD CONSTRAINT `receipt_vouchers_bank_account_fk` FOREIGN KEY (`company_bank_account_id`) REFERENCES `company_bank_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_sales_order_id_sales_orders_id_fk` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_vehicle_id_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_branch_id_pos_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `pos_branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_batch_id_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_model_id_motorcycle_models_id_fk` FOREIGN KEY (`model_id`) REFERENCES `motorcycle_models`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_color_id_colors_id_fk` FOREIGN KEY (`color_id`) REFERENCES `colors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bank_statement_lines_statement_idx` ON `bank_statement_lines` (`statement_id`);--> statement-breakpoint
CREATE INDEX `bank_statement_lines_match_idx` ON `bank_statement_lines` (`matched_type`,`matched_id`);--> statement-breakpoint
CREATE INDEX `batch_expenses_batch_idx` ON `batch_expenses` (`batch_id`);--> statement-breakpoint
CREATE INDEX `import_batches_supplier_idx` ON `import_batches` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `import_batches_loan_idx` ON `import_batches` (`loan_contract_id`);--> statement-breakpoint
CREATE INDEX `loan_repayments_loan_idx` ON `loan_repayments` (`loan_contract_id`);--> statement-breakpoint
CREATE INDEX `payment_vouchers_supplier_idx` ON `payment_vouchers` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `pos_branches_customer_idx` ON `pos_branches` (`customer_id`);--> statement-breakpoint
CREATE INDEX `receipt_vouchers_customer_idx` ON `receipt_vouchers` (`customer_id`);--> statement-breakpoint
CREATE INDEX `receipt_vouchers_branch_idx` ON `receipt_vouchers` (`branch_id`);--> statement-breakpoint
CREATE INDEX `sales_order_items_order_idx` ON `sales_order_items` (`sales_order_id`);--> statement-breakpoint
CREATE INDEX `sales_orders_customer_idx` ON `sales_orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_orders_branch_idx` ON `sales_orders` (`branch_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `vehicles_batch_idx` ON `vehicles` (`batch_id`);--> statement-breakpoint
CREATE INDEX `vehicles_model_idx` ON `vehicles` (`model_id`);--> statement-breakpoint
CREATE INDEX `vehicles_delivered_idx` ON `vehicles` (`is_delivered`);--> statement-breakpoint
CREATE INDEX `vehicles_invoiced_idx` ON `vehicles` (`is_invoiced`);