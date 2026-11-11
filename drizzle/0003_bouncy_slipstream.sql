ALTER TABLE `orders` ADD `fulfillment_status` text DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillment_updated_at` integer;