CREATE TABLE "follower_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"conversation_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"email_sent" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "follower_notifications" ADD CONSTRAINT "follower_notifications_follower_id_conversation_followers_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."conversation_followers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follower_notifications" ADD CONSTRAINT "follower_notifications_conversation_id_conversations_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follower_notifications" ADD CONSTRAINT "follower_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follower_notifications_follower_id_idx" ON "follower_notifications" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follower_notifications_conversation_id_idx" ON "follower_notifications" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "follower_notifications_user_id_idx" ON "follower_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "follower_notifications_status_idx" ON "follower_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "follower_notifications_type_idx" ON "follower_notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "follower_notifications_created_at_idx" ON "follower_notifications" USING btree ("created_at" DESC NULLS LAST);