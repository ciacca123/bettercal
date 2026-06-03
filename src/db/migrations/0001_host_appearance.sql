CREATE TABLE "host_appearance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"avatar_url" text,
	"brand_name" text,
	"accent_color" text,
	"bg_color" text,
	"text_color" text,
	"font_family" text,
	"show_duration" boolean DEFAULT true NOT NULL,
	"show_location" boolean DEFAULT true NOT NULL,
	"show_timezone" boolean DEFAULT true NOT NULL,
	"duration_label" text,
	"timezone_label" text,
	"icon_style" text DEFAULT 'emoji' NOT NULL,
	"theme_mode" text DEFAULT 'light' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_appearance_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "host_appearance" ADD CONSTRAINT "host_appearance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
