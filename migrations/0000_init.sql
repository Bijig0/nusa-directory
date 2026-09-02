CREATE TABLE `areas` (
	`id` text PRIMARY KEY NOT NULL,
	`city_id` text NOT NULL,
	`slug` text NOT NULL,
	`name_id` text NOT NULL,
	`name_en` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `areas_city_slug_uq` ON `areas` (`city_id`,`slug`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`actor_type` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`before` text,
	`after` text,
	`ip_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `boosts` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`order_id` text,
	`type` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `boosts_listing_idx` ON `boosts` (`listing_id`,`type`,`ends_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_id` text NOT NULL,
	`name_en` text NOT NULL,
	`desc_id` text NOT NULL,
	`desc_en` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `cities` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_id` text NOT NULL,
	`name_en` text NOT NULL,
	`province` text NOT NULL,
	`lat` real,
	`lng` real,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cities_slug_unique` ON `cities` (`slug`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`user_id` text,
	`free_reveal_used_at` integer,
	`ip_hash_first` text,
	`ua_hash` text,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `devices_wallet_idx` ON `devices` (`wallet_id`);--> statement-breakpoint
CREATE INDEX `devices_user_idx` ON `devices` (`user_id`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`wallet_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`wallet_id`, `listing_id`),
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`email` text,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identities_provider_uq` ON `identities` (`provider`,`provider_id`);--> statement-breakpoint
CREATE INDEX `identities_user_idx` ON `identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `listing_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`position` integer NOT NULL,
	`storage` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes_full` integer,
	`color_hex` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_listing_idx` ON `listing_photos` (`listing_id`,`position`);--> statement-breakpoint
CREATE TABLE `listing_services` (
	`listing_id` text NOT NULL,
	`service_id` text NOT NULL,
	PRIMARY KEY(`listing_id`, `service_id`),
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services_catalog`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listing_services_service_idx` ON `listing_services` (`service_id`);--> statement-breakpoint
CREATE TABLE `listing_stats_daily` (
	`listing_id` text NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`reveals` integer DEFAULT 0 NOT NULL,
	`wa_clicks` integer DEFAULT 0 NOT NULL,
	`tg_clicks` integer DEFAULT 0 NOT NULL,
	`favorites` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`listing_id`, `day`),
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`short_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`city_id` text NOT NULL,
	`area_id` text,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`age` integer NOT NULL,
	`gender` text NOT NULL,
	`nationality` text,
	`ethnicity` text,
	`height_cm` integer,
	`body_type` text,
	`languages` text DEFAULT '[]' NOT NULL,
	`rate_1h` integer,
	`rate_2h` integer,
	`rate_overnight` integer,
	`incall` integer DEFAULT false NOT NULL,
	`outcall` integer DEFAULT false NOT NULL,
	`availability` text,
	`phone_e164` text NOT NULL,
	`whatsapp_e164` text,
	`telegram_handle` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`moderation` text DEFAULT 'pending' NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`photo_count` integer DEFAULT 0 NOT NULL,
	`cover_photo_id` text,
	`bumped_at` integer,
	`featured_until` integer,
	`vip_until` integer,
	`published_at` integer,
	`expires_at` integer,
	`renewal_reminder_sent_at` integer,
	`declaration_accepted_at` integer,
	`declaration_version` integer,
	`removed_reason` text,
	`edited_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_short_id_unique` ON `listings` (`short_id`);--> statement-breakpoint
CREATE INDEX `listings_browse_idx` ON `listings` (`city_id`,`category_id`,`status`,`bumped_at`);--> statement-breakpoint
CREATE INDEX `listings_area_idx` ON `listings` (`city_id`,`category_id`,`area_id`,`status`);--> statement-breakpoint
CREATE INDEX `listings_owner_idx` ON `listings` (`owner_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `listings_expiry_idx` ON `listings` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `listings_moderation_idx` ON `listings` (`moderation`,`updated_at`);--> statement-breakpoint
CREATE INDEX `listings_phone_idx` ON `listings` (`phone_e164`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`user_id` text,
	`product_id` text NOT NULL,
	`product_code` text NOT NULL,
	`listing_id` text,
	`amount_idr` integer NOT NULL,
	`credits` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`snap_token` text,
	`snap_redirect_url` text,
	`midtrans_transaction_id` text,
	`payment_type` text,
	`paid_at` integer,
	`fulfilled_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `orders_wallet_idx` ON `orders` (`wallet_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`destination` text NOT NULL,
	`purpose` text DEFAULT 'login' NOT NULL,
	`link_user_id` text,
	`code_hash` text NOT NULL,
	`link_token_hash` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`ip_hash` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `otp_destination_idx` ON `otp_codes` (`destination`,`created_at`);--> statement-breakpoint
CREATE INDEX `otp_expires_idx` ON `otp_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`provider` text DEFAULT 'midtrans' NOT NULL,
	`transaction_id` text NOT NULL,
	`transaction_status` text NOT NULL,
	`status_code` text,
	`fraud_status` text,
	`signature_valid` integer NOT NULL,
	`payload` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_uq` ON `payment_events` (`provider`,`transaction_id`,`transaction_status`);--> statement-breakpoint
CREATE TABLE `phone_claims` (
	`phone_e164` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`claimed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`name_id` text NOT NULL,
	`name_en` text NOT NULL,
	`price_idr` integer NOT NULL,
	`credits` integer,
	`duration_days` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE TABLE `rate_windows` (
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `window_start`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`wallet_id` text,
	`reason` text NOT NULL,
	`details` text,
	`ip_hash` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_listing_idx` ON `reports` (`listing_id`);--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `reveals` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reveals_wallet_listing_uq` ON `reveals` (`wallet_id`,`listing_id`);--> statement-breakpoint
CREATE INDEX `reveals_listing_idx` ON `reveals` (`listing_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`wallet_id` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`poster_reply` text,
	`poster_replied_at` integer,
	`moderated_by` text,
	`moderated_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_listing_wallet_uq` ON `reviews` (`listing_id`,`wallet_id`);--> statement-breakpoint
CREATE INDEX `reviews_listing_status_idx` ON `reviews` (`listing_id`,`status`);--> statement-breakpoint
CREATE TABLE `services_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_id` text NOT NULL,
	`name_en` text NOT NULL,
	`category_scope` text,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_catalog_slug_unique` ON `services_catalog` (`slug`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`ip_hash` text,
	`ua_hash` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`banned_reason` text,
	`wallet_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE TABLE `wallet_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_type` text,
	`ref_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ledger_wallet_idx` ON `wallet_ledger` (`wallet_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`merged_into_wallet_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
