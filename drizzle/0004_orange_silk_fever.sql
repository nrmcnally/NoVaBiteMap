CREATE TABLE `alpha_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`location_id` text,
	`category` text NOT NULL,
	`page_url` text,
	`message` text NOT NULL,
	`contact_ok` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alpha_feedback_user_created_idx` ON `alpha_feedback` (`user_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `alpha_feedback_location_idx` ON `alpha_feedback` (`location_id`);--> statement-breakpoint
CREATE INDEX `alpha_feedback_status_idx` ON `alpha_feedback` (`status`);