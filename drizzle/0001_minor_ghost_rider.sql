CREATE TABLE `account_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `account_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_sessions_token_idx` ON `account_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `account_sessions_user_idx` ON `account_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_sessions_expires_idx` ON `account_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `account_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_users_email_idx` ON `account_users` (`email`);