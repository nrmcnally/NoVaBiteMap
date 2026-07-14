CREATE TABLE `saved_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`location_id` text NOT NULL,
	`nickname` text,
	`notes` text,
	`preferred_species` text,
	`access_method` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_locations_user_location_idx` ON `saved_locations` (`user_email`,`location_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_email` text PRIMARY KEY NOT NULL,
	`preferred_species` text,
	`default_radius_minutes` integer DEFAULT 45 NOT NULL,
	`default_access_methods` text DEFAULT 'shore' NOT NULL,
	`units` text DEFAULT 'imperial' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
