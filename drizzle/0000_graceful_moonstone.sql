CREATE TABLE `cashier_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`closing_balance` integer,
	`expected_balance` integer DEFAULT 0 NOT NULL,
	`actual_balance` integer DEFAULT 0 NOT NULL,
	`opening_time` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`closing_time` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cashier_shifts_user_idx` ON `cashier_shifts` (`user_id`);