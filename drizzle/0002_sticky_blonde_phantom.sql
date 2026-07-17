CREATE TABLE `fishing_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`location_id` text NOT NULL,
	`species_id` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`angler_count` integer DEFAULT 1 NOT NULL,
	`effort_minutes` integer NOT NULL,
	`catch_count` integer NOT NULL,
	`zero_catch_explicit` integer NOT NULL,
	`location_detail` text,
	`lure_or_bait` text,
	`observed_water_temperature_c` real,
	`observed_clarity` text,
	`notes` text,
	`consent_for_aggregate_analysis` integer DEFAULT false NOT NULL,
	`source_type` text DEFAULT 'first-party-alpha-trip-log' NOT NULL,
	`candidate_cohort` integer DEFAULT false NOT NULL,
	`calibration_eligible` integer DEFAULT false NOT NULL,
	`validation_eligible` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fishing_trips_user_started_idx` ON `fishing_trips` (`user_email`,`started_at`);--> statement-breakpoint
CREATE INDEX `fishing_trips_location_species_idx` ON `fishing_trips` (`location_id`,`species_id`);