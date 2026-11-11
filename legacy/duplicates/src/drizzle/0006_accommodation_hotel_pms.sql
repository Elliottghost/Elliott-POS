-- Phase 7: Accommodation & Hotel PMS
-- ========================================

-- ============================================================
-- ROOM TYPES
-- ============================================================
CREATE TABLE `room_types` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `category` text NOT NULL DEFAULT 'standard',
  `base_price`: integer NOT NULL DEFAULT 0,
  `is_active`: integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
) ENGINE=InnoDB;

-- ============================================================
-- ROOMS
-- ============================================================
CREATE TABLE `rooms` (
  `id` text PRIMARY KEY NOT NULL,
  `room_number` text NOT NULL,
  `room_type_id`: text NOT NULL,
  `branch_id`: text NOT NULL,
  `capacity`: integer DEFAULT 2 NOT NULL,
  `bed_count`: integer DEFAULT 1 NOT NULL,
  `description`: text,
  `amenities`: text,
  `image_path`: text,
  `standard_price`: integer DEFAULT 0 NOT NULL,
  `special_rate`: integer,
  `status`: text DEFAULT 'available' NOT NULL,
  `is_active`: integer DEFAULT true NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
) ENGINE=InnoDB;

-- ============================================================
-- ACCOMMODATION RESERVATIONS
-- ============================================================
CREATE TABLE `accommodation_reservations` (
  `id`: text PRIMARY KEY NOT NULL,
  `branch_id`: text NOT NULL,
  `room_id`: text,
  `customer_name`: text NOT NULL,
  `customer_phone`: text NOT NULL,
  `customer_email`: text,
  `check_in_date`: text NOT NULL,
  `check_in_time`: text DEFAULT '14:00' NOT NULL,
  `check_out_date`: text NOT NULL,
  `check_out_time`: text DEFAULT '11:00' NOT NULL,
  `guest_count`: integer DEFAULT 2 NOT NULL,
  `status`: text DEFAULT 'pending' NOT NULL,
  `deposit_paid`: integer DEFAULT 0 NOT NULL,
  `total_amount`: integer DEFAULT 0 NOT NULL,
  `paid_amount`: integer DEFAULT 0 NOT NULL,
  `special_requests`: text,
  `created_by_user_id`: text,
  `checked_in_at`: integer,
  `checked_out_at`: integer,
  `created_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
) ENGINE=InnoDB;

-- ============================================================
-- EXTRA GUEST CHARGES
-- ============================================================
CREATE TABLE `extra_guest_charges` (
  `id`: text PRIMARY KEY NOT NULL,
  `room_type_id`: text NOT NULL,
  `extra_guest_count`: integer DEFAULT 1 NOT NULL,
  `extra_charge`: integer DEFAULT 0 NOT NULL,
  `is_active`: integer DEFAULT true NOT NULL,
  `created_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON UPDATE no action ON DELETE restrict
) ENGINE=InnoDB;

-- ============================================================
-- ROOM SERVICE ORDERS
-- ============================================================
CREATE TABLE `room_service_orders` (
  `id`: text PRIMARY KEY NOT NULL,
  `reservation_id`: text NOT NULL,
  `branch_id`: text NOT NULL,
  `guest_name`: text NOT NULL,
  `room_number`: text NOT NULL,
  `items_json`: text NOT NULL,
  `subtotal`: integer DEFAULT 0 NOT NULL,
  `service_charge`: integer DEFAULT 0 NOT NULL,
  `tax`: integer DEFAULT 0 NOT NULL,
  `total`: integer DEFAULT 0 NOT NULL,
  `status`: text DEFAULT 'pending' NOT NULL,
  `fulfillment_status`: text DEFAULT 'queued' NOT NULL,
  `fulfillment_updated_at`: integer,
  `created_by_user_id`: text NOT NULL,
  `created_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`reservation_id`) REFERENCES `accommodation_reservations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
) ENGINE=InnoDB;

-- ============================================================
-- ROOM SERVICE ITEMS
-- ============================================================
CREATE TABLE `room_service_items` (
  `id`: text PRIMARY KEY NOT NULL,
  `room_service_order_id`: text NOT NULL,
  `menu_item_id`: text NOT NULL,
  `name_snapshot`: text NOT NULL,
  `unit_price`: integer NOT NULL,
  `quantity`: integer DEFAULT 1 NOT NULL,
  `line_total`: integer NOT NULL,
  `notes`: text,
  `created_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`room_service_order_id`) REFERENCES `room_service_orders`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE restrict
) ENGINE=InnoDB;

-- ==========================================================--
-- GUEST FOLIO / BILLING
-- ============================================================
CREATE TABLE `guest_folios` (
  `id`: text PRIMARY KEY NOT NULL,
  `reservation_id`: text NOT NULL,
  `branch_id`: text NOT NULL,
  `room_id`: text NOT NULL,
  `opening_balance`: integer DEFAULT 0 NOT NULL,
  `current_balance`: integer DEFAULT 0 NOT NULL,
  `room_charges`: integer DEFAULT 0 NOT NULL,
  `food_beverage_charges`: integer DEFAULT 0 NOT NULL,
  `room_service_charges`: integer DEFAULT 0 NOT NULL,
  `other_charges`: integer DEFAULT 0 NOT NULL,
  `total_paid`: integer DEFAULT 0 NOT NULL,
  `outstanding_balance`: integer DEFAULT 0 NOT NULL,
  `status`: text DEFAULT 'active' NOT NULL, -- active, settled, closed
  `created_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`reservation_id`) REFERENCES `accommodation_reservations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict
) ENGINE=InnoDB;

-- ==========================================================--
-- HOUSEKEEPING TASKS
-- ============================================================
CREATE TABLE `housekeeping_tasks` (
  `id`: text PRIMARY KEY NOT NULL,
  `room_id`: text NOT NULL,
  `branch_id`: text NOT NULL,
  `task_type`: text DEFAULT 'cleaning' NOT NULL, -- cleaning, maintenance, inspection
  `status`: text DEFAULT 'pending' NOT NULL, -- pending, in_progress, completed, needs_attention
  `assigned_to_user_id`: text,
  `completed_by_user_id`: text,
  `started_at`: integer,
  `completed_at`: integer,
  `notes`: text,
  `priority`: integer DEFAULT 1 NOT NULL,
  `created_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`completed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
) ENGINE=InnoDB;

-- ==========================================================--
-- ROOM TRANSACTION LOG
-- ============================================================
CREATE TABLE `room_transactions` (
  `id`: text PRIMARY KEY NOT NULL,
  `reservation_id`: text,
  `room_id`: text NOT NULL,
  `branch_id`: text NOT NULL,
  `transaction_type`: text NOT NULL, -- check_in, check_out, room_service, payment, adjustment, cancellation
  `amount`: integer DEFAULT 0 NOT NULL,
  `description`: text,
  `recorded_by_user_id`: text NOT NULL,
  `created_at`: integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`reservation_id`) REFERENCES `accommodation_reservations`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
) ENGINE=InnoDB;

-- ==========================================================--
-- SEED ROOM TYPES
-- ============================================================
INSERT INTO `room_types` (`id`, `name`, `description`, `category`, `base_price`, `is_active`, `created_at`, `updated_at`) VALUES
('rt-standard', 'Standard Room', 'Comfortable room with basic amenities', 'standard', 80000, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('rt-de luxe', 'Deluxe Room', 'Spacious room with enhanced features', 'deluxe', 120000, 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('rt-executive', 'Executive Room', 'Luxury room with premium services', 'executive', 180000, 1, (unixepoch() * 1000), (unixepoch() * 1000));

-- ==========================================================--
-- INITIAL ROOMS SEED DATA (both branches)
-- ============================================================
-- Kimironko rooms
INSERT INTO `rooms` (`id`, `room_number`, `room_type_id`, `branch_id`, `capacity`, `bed_count`, `description`, `amenities`, `standard_price`, `special_rate`, `status`, `is_active`, `created_at`, `updated_at`) VALUES
('kim-101', '101', 'rt-standard', 'kimironko-branch', 2, 1, 'Standard room at Kimironko', 'TV, WiFi, Mini-bar', 80000, NULL, 'available', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('kim-102', '102', 'rt-standard', 'kimironko-branch', 2, 1, 'Standard room at Kimironko', 'TV, WiFi, Mini-bar', 80000, NULL, 'available', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('kim-103', '103', 'rt-de luxe', 'kimironko-branch', 2, 2, 'Deluxe room at Kimironko', 'City view, Jacuzzi, minibar', 120000, NULL, 'available', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('kim-201', '201', 'rt-executive', 'kimironko-branch', 2, 1, 'Executive suite at Kimironko', 'Living area, minibar, workspace', 180000, NULL, 'available', 1, (unixepoch() * 1000), (unixepoch() * 1000)),

-- Rond-Point rooms
('rdp-101', '101', 'rt-standard', 'rond-point-branch', 2, 1, 'Standard room at Rond-Point', 'TV, WiFi, Mini-bar', 80000, NULL, 'available', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('rdp-102', '102', 'rt-standard', 'rond-point-branch', 2, 1, 'Standard room at Rond-Point', 'TV, WiFi, Mini-bar', 80000, NULL, 'available', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('rdp-103', '103', 'rt-de luxe', 'rond-point-branch', 2, 2, 'Deluxe room at Rond-Point', 'Garden view, Jacuzzi, minibar', 120000, NULL, 'available', 1, (unixepoch() * 1000), (unixepoch() * 1000)),
('rdp-201', '201', 'rt-executive', 'rond-point-branch', 2, 1, 'Executive suite at Rond-Point', 'Living area, minibar, workspace', 180000, NULL, 'available', 1, (unixepoch() * 1000), (unixepoch() * 1000));