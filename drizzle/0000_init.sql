CREATE TYPE "public"."notification_delivery_status" AS ENUM('NOT_CONFIGURED', 'QUEUED', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."modification_status" AS ENUM('APPLIED', 'AWAITING_PAYMENT', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'WHATSAPP');--> statement-breakpoint
CREATE TYPE "public"."order_payment_status" AS ENUM('UNPAID', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('AWAITING_PAYMENT', 'PAYMENT_FAILED', 'EXPIRED', 'PENDING_APPROVAL', 'AWAITING_ADDITIONAL_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('PICKUP', 'DELIVERY');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('PAYSTACK', 'DEV_SIM', 'DEMO_SEED');--> statement-breakpoint
CREATE TYPE "public"."payment_purpose" AS ENUM('ORDER', 'ADDITIONAL');--> statement-breakpoint
CREATE TYPE "public"."payment_txn_status" AS ENUM('INITIALIZED', 'SUCCESS', 'FAILED', 'ABANDONED');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role" text NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permission_role_permission_key_pk" PRIMARY KEY("role","permission_key")
);
--> statement-breakpoint
CREATE TABLE "saved_address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"landmark" text,
	"instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "staff_branch" (
	"user_id" text NOT NULL,
	"branch_id" uuid NOT NULL,
	CONSTRAINT "staff_branch_user_id_branch_id_pk" PRIMARY KEY("user_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'CUSTOMER' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"phone" text,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_permission_override" (
	"user_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"granted" boolean NOT NULL,
	CONSTRAINT "user_permission_override_user_id_permission_key_pk" PRIMARY KEY("user_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"is_open" boolean DEFAULT true NOT NULL,
	"closed_message" text,
	"accepting_orders" boolean DEFAULT true NOT NULL,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"delivery_enabled" boolean DEFAULT true NOT NULL,
	"delivery_fee_kobo" integer DEFAULT 0 NOT NULL,
	"prep_time_mins" integer DEFAULT 20 NOT NULL,
	"enforce_hours" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_slug_unique" UNIQUE("slug"),
	CONSTRAINT "branch_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "branch_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"opens" text,
	"closes" text,
	"closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "branch_hours_day_uq" UNIQUE("branch_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "site_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branch_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_product_uq" UNIQUE("branch_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_delta_kobo" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"image_is_illustrative" boolean DEFAULT false NOT NULL,
	"base_price_kobo" integer NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slug_unique" UNIQUE("slug"),
	CONSTRAINT "product_price_nonneg" CHECK ("product"."base_price_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_info" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"landmark" text,
	"instructions" text
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"branch_id" uuid NOT NULL,
	"customer_user_id" text,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"type" "order_type" NOT NULL,
	"pickup_time" text,
	"subtotal_kobo" integer NOT NULL,
	"delivery_fee_kobo" integer DEFAULT 0 NOT NULL,
	"total_kobo" integer NOT NULL,
	"paid_kobo" integer DEFAULT 0 NOT NULL,
	"status" "order_status" DEFAULT 'AWAITING_PAYMENT' NOT NULL,
	"status_before_hold" "order_status",
	"payment_status" "order_payment_status" DEFAULT 'UNPAID' NOT NULL,
	"tracking_token_hash" text NOT NULL,
	"staff_note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_reference_unique" UNIQUE("reference"),
	CONSTRAINT "order_amounts_nonneg" CHECK ("order"."total_kobo" >= 0 AND "order"."paid_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"category_name" text NOT NULL,
	"unit_price_kobo" integer NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_kobo" integer NOT NULL,
	CONSTRAINT "order_item_qty_pos" CHECK ("order_item"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_modification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"actor_user_id" text,
	"reason" text,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"delta_kobo" integer NOT NULL,
	"status" "modification_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"modification_id" uuid,
	"purpose" "payment_purpose" DEFAULT 'ORDER' NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"reference" text NOT NULL,
	"amount_kobo" integer NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"status" "payment_txn_status" DEFAULT 'INITIALIZED' NOT NULL,
	"authorization_url" text,
	"provider_transaction_id" text,
	"channel" text,
	"failure_reason" text,
	"verified_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_reference_unique" UNIQUE("reference"),
	CONSTRAINT "payment_amount_pos" CHECK ("payment"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_event_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"actor_label" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"branch_id" uuid,
	"data" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dev_sim_record" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" text,
	"permission_key" text,
	"branch_id" uuid,
	"order_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"recipient" text NOT NULL,
	"template" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "notification_delivery_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_read" (
	"notification_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_key_permission_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permission"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_address" ADD CONSTRAINT "saved_address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_branch" ADD CONSTRAINT "staff_branch_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_branch" ADD CONSTRAINT "staff_branch_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "user_permission_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "user_permission_override_permission_key_permission_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permission"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_hours" ADD CONSTRAINT "branch_hours_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_product" ADD CONSTRAINT "branch_product_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_product" ADD CONSTRAINT "branch_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option" ADD CONSTRAINT "option_group_id_option_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."option_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_group" ADD CONSTRAINT "option_group_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_info" ADD CONSTRAINT "delivery_info_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_user_id_user_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_modification" ADD CONSTRAINT "order_modification_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_modification" ADD CONSTRAINT "order_modification_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_read" ADD CONSTRAINT "notification_read_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_read" ADD CONSTRAINT "notification_read_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_address_user_idx" ON "saved_address" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "option_group_idx" ON "option" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "option_group_product_idx" ON "option_group" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_category_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "order_branch_status_created_idx" ON "order" USING btree ("branch_id","status","created_at");--> statement-breakpoint
CREATE INDEX "order_payment_status_idx" ON "order" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "order_customer_idx" ON "order" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "order_created_idx" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_item_product_idx" ON "order_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_mod_order_idx" ON "order_modification" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "osh_order_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_order_idx" ON "payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_created_idx" ON "notification" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_branch_idx" ON "notification" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "notification_delivery_order_idx" ON "notification_delivery" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_read_uq" ON "notification_read" USING btree ("notification_id","user_id");