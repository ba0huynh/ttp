CREATE TABLE `role_permissions` (
	`role_id` int NOT NULL,
	`permission` varchar(64) NOT NULL,
	CONSTRAINT `role_permissions_role_id_permission_pk` PRIMARY KEY(`role_id`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` varchar(255),
	`is_admin` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `role_id` int;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `roles` (`name`, `description`, `is_admin`) VALUES
	('Quản trị', 'Toàn quyền hệ thống', 1),
	('Kế toán', 'Công nợ, thu chi, khế ước vay, đối chiếu sao kê', 0),
	('Kinh doanh', 'Lập phiếu bán, quản lý khách hàng', 0),
	('Thủ kho', 'Nhập lô, kho xe, giao xe thực tế', 0);
--> statement-breakpoint
INSERT INTO `role_permissions` (`role_id`, `permission`)
SELECT `id`, `permission` FROM `roles`
JOIN (
	SELECT 'dashboard.view' AS `permission`
	UNION ALL
	SELECT 'reports.view' AS `permission`
	UNION ALL
	SELECT 'batches.view' AS `permission`
	UNION ALL
	SELECT 'inventory.view' AS `permission`
	UNION ALL
	SELECT 'sales.view' AS `permission`
	UNION ALL
	SELECT 'sales.invoice' AS `permission`
	UNION ALL
	SELECT 'loans.view' AS `permission`
	UNION ALL
	SELECT 'loans.manage' AS `permission`
	UNION ALL
	SELECT 'finance.view' AS `permission`
	UNION ALL
	SELECT 'finance.manage' AS `permission`
	UNION ALL
	SELECT 'reconcile.view' AS `permission`
	UNION ALL
	SELECT 'reconcile.manage' AS `permission`
	UNION ALL
	SELECT 'customers.view' AS `permission`
	UNION ALL
	SELECT 'master-data.view' AS `permission`
) AS `p`
WHERE `roles`.`name` = 'Kế toán';
--> statement-breakpoint
INSERT INTO `role_permissions` (`role_id`, `permission`)
SELECT `id`, `permission` FROM `roles`
JOIN (
	SELECT 'dashboard.view' AS `permission`
	UNION ALL
	SELECT 'reports.view' AS `permission`
	UNION ALL
	SELECT 'batches.view' AS `permission`
	UNION ALL
	SELECT 'inventory.view' AS `permission`
	UNION ALL
	SELECT 'sales.view' AS `permission`
	UNION ALL
	SELECT 'sales.create' AS `permission`
	UNION ALL
	SELECT 'customers.view' AS `permission`
	UNION ALL
	SELECT 'customers.manage' AS `permission`
) AS `p`
WHERE `roles`.`name` = 'Kinh doanh';
--> statement-breakpoint
INSERT INTO `role_permissions` (`role_id`, `permission`)
SELECT `id`, `permission` FROM `roles`
JOIN (
	SELECT 'dashboard.view' AS `permission`
	UNION ALL
	SELECT 'batches.view' AS `permission`
	UNION ALL
	SELECT 'batches.manage' AS `permission`
	UNION ALL
	SELECT 'inventory.view' AS `permission`
	UNION ALL
	SELECT 'sales.view' AS `permission`
	UNION ALL
	SELECT 'sales.deliver' AS `permission`
) AS `p`
WHERE `roles`.`name` = 'Thủ kho';
--> statement-breakpoint
UPDATE `users` SET `role_id` = (SELECT `id` FROM `roles` WHERE `name` = 'Quản trị') WHERE `role` = 'admin';
--> statement-breakpoint
UPDATE `users` SET `role_id` = (SELECT `id` FROM `roles` WHERE `name` = 'Kế toán') WHERE `role` = 'accountant';
--> statement-breakpoint
UPDATE `users` SET `role_id` = (SELECT `id` FROM `roles` WHERE `name` = 'Kinh doanh') WHERE `role` = 'sales';
--> statement-breakpoint
UPDATE `users` SET `role_id` = (SELECT `id` FROM `roles` WHERE `name` = 'Thủ kho') WHERE `role` = 'warehouse';
