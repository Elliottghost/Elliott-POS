ALTER TABLE `order_items` ADD `fulfillment_status` text DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `fulfillment_updated_at` integer;--> statement-breakpoint
UPDATE `order_items` SET `fulfillment_status` = COALESCE((SELECT `fulfillment_status` FROM `orders` WHERE `orders`.`id` = `order_items`.`order_id`), 'queued'), `fulfillment_updated_at` = (SELECT `fulfillment_updated_at` FROM `orders` WHERE `orders`.`id` = `order_items`.`order_id`);
