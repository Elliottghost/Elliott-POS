CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`table_id` text,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`reservation_date` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_minutes` integer DEFAULT 90 NOT NULL,
	`guest_count` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`special_requests` text,
	`cancellation_reason` text,
	`created_by_user_id` text,
	`updated_by_user_id` text,
	`confirmed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`table_id`) REFERENCES `restaurant_tables`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reservations_branch_date_idx` ON `reservations` (`branch_id`,`reservation_date`);--> statement-breakpoint
CREATE INDEX `reservations_table_date_idx` ON `reservations` (`table_id`,`reservation_date`);--> statement-breakpoint
CREATE INDEX `reservations_status_idx` ON `reservations` (`status`);--> statement-breakpoint
CREATE TABLE `restaurant_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text,
	`capacity` integer DEFAULT 4 NOT NULL,
	`section` text DEFAULT 'Main room' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`qr_token` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `restaurant_tables_qr_token_unique` ON `restaurant_tables` (`qr_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `restaurant_tables_branch_code_idx` ON `restaurant_tables` (`branch_id`,`code`);--> statement-breakpoint
CREATE INDEX `restaurant_tables_branch_idx` ON `restaurant_tables` (`branch_id`);--> statement-breakpoint
ALTER TABLE `branch_menu_items` ADD `price_override` integer;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `image_path` text;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `prep_minutes` integer;--> statement-breakpoint
ALTER TABLE `menu_items` ADD `is_featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
/* Align the launch menu with the restaurant module's category set. */
UPDATE `menu_categories` SET `name` = 'Starters' WHERE `name` = 'Starters & Salads';--> statement-breakpoint
UPDATE `menu_categories` SET `name` = 'Main Courses' WHERE `name` = 'Grill & Mains';--> statement-breakpoint
UPDATE `menu_categories` SET `name` = 'Cocktails' WHERE `name` = 'Bar & Cocktails';--> statement-breakpoint
UPDATE `menu_categories` SET `name` = 'Beverages' WHERE `name` = 'Soft Drinks';--> statement-breakpoint
INSERT INTO `menu_categories` (`id`, `name`, `description`, `sort_order`, `is_active`) VALUES ('cat-menu-food', 'Food', 'Sharing plates and light bites', 15, 1) ON CONFLICT(`name`) DO NOTHING;--> statement-breakpoint
INSERT INTO `menu_categories` (`id`, `name`, `description`, `sort_order`, `is_active`) VALUES ('cat-menu-wines', 'Wines', 'Bottles and by the glass', 35, 1) ON CONFLICT(`name`) DO NOTHING;--> statement-breakpoint
INSERT INTO `menu_categories` (`id`, `name`, `description`, `sort_order`, `is_active`) VALUES ('cat-menu-spirits', 'Spirits', 'Whisky, gin, rum and cognac', 40, 1) ON CONFLICT(`name`) DO NOTHING;--> statement-breakpoint
INSERT INTO `menu_categories` (`id`, `name`, `description`, `sort_order`, `is_active`) VALUES ('cat-menu-other', 'Other', 'Anything that does not fit elsewhere', 90, 1) ON CONFLICT(`name`) DO NOTHING;--> statement-breakpoint
UPDATE `menu_items` SET `category_id` = (SELECT `id` FROM `menu_categories` WHERE `name` = 'Wines' LIMIT 1) WHERE `name` IN ('House red wine, glass');--> statement-breakpoint
UPDATE `menu_items` SET `category_id` = (SELECT `id` FROM `menu_categories` WHERE `name` = 'Spirits' LIMIT 1) WHERE `name` IN ('Whisky, dose');--> statement-breakpoint
UPDATE `menu_items` SET `category_id` = (SELECT `id` FROM `menu_categories` WHERE `name` = 'Beverages' LIMIT 1) WHERE `name` IN ('Primus, 33cl', 'Mutzig, 33cl', 'Fanta or Coke, 30cl', 'Fresh passion juice', 'Still water, 50cl', 'Rwandan coffee');--> statement-breakpoint
/* Sensible preparation times by section, and two signature dishes featured. */
UPDATE `menu_items` SET `prep_minutes` = 12 WHERE `category_id` IN (SELECT `id` FROM `menu_categories` WHERE `name` IN ('Starters', 'Food'));--> statement-breakpoint
UPDATE `menu_items` SET `prep_minutes` = 25 WHERE `category_id` IN (SELECT `id` FROM `menu_categories` WHERE `name` = 'Main Courses');--> statement-breakpoint
UPDATE `menu_items` SET `prep_minutes` = 15 WHERE `category_id` IN (SELECT `id` FROM `menu_categories` WHERE `name` = 'Desserts');--> statement-breakpoint
UPDATE `menu_items` SET `prep_minutes` = 5 WHERE `category_id` IN (SELECT `id` FROM `menu_categories` WHERE `name` IN ('Beverages', 'Cocktails', 'Wines', 'Spirits'));--> statement-breakpoint
UPDATE `menu_items` SET `is_featured` = 1 WHERE `name` IN ('Grilled tilapia', 'Tropical cocktail');
