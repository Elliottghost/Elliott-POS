-- Phase 6: Inventory & Finance Management
-- ========================================

-- ============================================================
-- INVENTORY CATEGORIES
-- ============================================================
CREATE TABLE `inventory_categories` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  UNIQUE INDEX `inventory_categories_name_unique` (`name`)
) ENGINE=InnoDB;

-- ============================================================
-- INVENTORY ITEMS
-- ============================================================
CREATE TABLE `inventory_items` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `sku` text NOT NULL,
  `category_id` text NOT NULL,
  `description` text,
  `unit_of_measurement` text DEFAULT 'pieces' NOT NULL,
  `purchase_price` integer DEFAULT 0 NOT NULL,
  `current_stock` integer DEFAULT 0 NOT NULL,
  `minimum_stock_level` integer DEFAULT 0 NOT NULL,
  `supplier_id` text,
  `branch_id` text NOT NULL,
  `expiry_date` text,
  `storage_location` text,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  UNIQUE INDEX `inventory_items_sku_unique` (`sku`),
  FOREIGN KEY (`category_id`) REFERENCES `inventory_categories`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict
) ENGINE=InnoDB;

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE `suppliers` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `contact_person` text,
  `phone` text,
  `email` text,
  `address` text,
  `notes` text,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
) ENGINE=InnoDB;

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE `purchase_orders` (
  `id` text PRIMARY KEY NOT NULL,
  `order_number` text NOT NULL,
  `supplier_id` text NOT NULL,
  `branch_id` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `expected_delivery` text,
  `notes` text,
  `total_amount` integer DEFAULT 0 NOT NULL,
  `paid_amount` integer DEFAULT 0 NOT NULL,
  `created_by_user_id` text,
  `confirmed_at` integer,
  `received_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
) ENGINE=InnoDB;

-- ============================================================
-- PURCHASE ORDER ITEMS
-- ============================================================
CREATE TABLE `purchase_order_items` (
  `id` text PRIMARY KEY NOT NULL,
  `purchase_order_id` text NOT NULL,
  `inventory_item_id` text NOT NULL,
  `quantity_ordered` integer NOT NULL,
  `quantity_received` integer DEFAULT 0 NOT NULL,
  `unit_cost` integer NOT NULL,
  `line_total` integer NOT NULL,
  `notes` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE restrict
) ENGINE=InnoDB;

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TABLE `stock_movements` (
  `id` text PRIMARY KEY NOT NULL,
  `inventory_item_id` text NOT NULL,
  `movement_type` text NOT NULL,
  `quantity` integer NOT NULL,
  `source_branch_id` text,
  `destination_branch_id` text,
  `reference_type` text,
  `reference_id` text,
  `staff_user_id` text,
  `reason` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`source_branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`destination_branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
) ENGINE=InnoDB;

-- ============================================================
-- RECIPES
-- ============================================================
CREATE TABLE `recipes` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
) ENGINE=InnoDB;

-- ============================================================
-- RECIPE INGREDIENTS
-- ============================================================
CREATE TABLE `recipe_ingredients` (
  `id` text PRIMARY KEY NOT NULL,
  `recipe_id` text NOT NULL,
  `inventory_item_id` text NOT NULL,
  `quantity` integer NOT NULL,
  `unit_of_measurement` text DEFAULT 'pieces' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE restrict
) ENGINE=InnoDB;

-- ============================================================
-- INCOME RECORDS
-- ============================================================
CREATE TABLE `income_records` (
  `id` text PRIMARY KEY NOT NULL,
  `source` text NOT NULL,
  `reference_type` text,
  `reference_id` text,
  `amount` integer NOT NULL,
  `branch_id` text,
  `currency` text DEFAULT 'RWF' NOT NULL,
  `recorded_by_user_id` text,
  `description` text,
  `date` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
) ENGINE=InnoDB;

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE `expenses` (
  `id` text PRIMARY KEY NOT NULL,
  `description` text NOT NULL,
  `category` text NOT NULL,
  `amount` integer NOT NULL,
  `branch_id` text,
  `payment_method` text DEFAULT 'cash' NOT NULL,
  `date` text NOT NULL,
  `recorded_by_user_id` text,
  `receipt_path` text,
  `is_recurring` integer DEFAULT false NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
) ENGINE=InnoDB;

-- ============================================================
-- INITIAL INVENTORY CATEGORIES SEED DATA
-- ============================================================
INSERT INTO `inventory_categories` (`id`, `name`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
('cat-food', 'Food ingredients', 'Core food ingredients for kitchen', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('cat-meat', 'Meat and poultry', 'Fresh and processed meat products', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('cat-fish', 'Fish and seafood', 'Fresh fish and seafood products', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('cat-vegetables', 'Vegetables and fruits', 'Fresh produce for kitchen', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('cat-beverages', 'Beverages', 'Drinks and non-alcoholic beverages', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('cat-alcoholic', 'Alcoholic drinks', 'Wines, spirits, beers and liqueurs', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('cat-cleaning', 'Cleaning materials', 'Cleaning and hygiene supplies', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('cat-kitchen', 'Kitchen supplies', 'Utensils, disposables and kitchen tools', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('cat-other', 'Other operating supplies', 'Any operating supplies not covered above', 1, (unixepoch() * 1000), (unixepoch() * 1000));