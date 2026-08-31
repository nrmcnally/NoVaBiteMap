CREATE TABLE `hydrology_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`from_location_id` text NOT NULL,
	`to_location_id` text NOT NULL,
	`flow_kind` text DEFAULT 'downstream' NOT NULL,
	`direction_basis` text DEFAULT 'unknown' NOT NULL,
	`elevation_drop_feet` real,
	`path_json` text NOT NULL,
	`notes` text,
	`created_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hydrology_connections_direction_idx` ON `hydrology_connections` (`from_location_id`,`to_location_id`);--> statement-breakpoint
CREATE INDEX `hydrology_connections_to_idx` ON `hydrology_connections` (`to_location_id`);--> statement-breakpoint
CREATE INDEX `hydrology_connections_kind_idx` ON `hydrology_connections` (`flow_kind`);--> statement-breakpoint
CREATE TABLE `hydrology_node_elevations` (
	`location_id` text PRIMARY KEY NOT NULL,
	`elevation_feet` real NOT NULL,
	`resolution_meters` real,
	`source` text DEFAULT 'USGS 3DEP EPQS' NOT NULL,
	`source_url` text NOT NULL,
	`sampled_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
