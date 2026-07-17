ALTER TABLE `fishing_trips` ADD `condition_replay_id` text;--> statement-breakpoint
ALTER TABLE `fishing_trips` ADD `condition_replay_status` text DEFAULT 'not-requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `fishing_trips` ADD `condition_replay_policy_version` text;--> statement-breakpoint
ALTER TABLE `fishing_trips` ADD `condition_replay` text;--> statement-breakpoint
ALTER TABLE `fishing_trips` ADD `condition_replayed_at` text;