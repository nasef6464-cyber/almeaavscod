CREATE TABLE "access_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"school_id" text NOT NULL,
	"package_id" text NOT NULL,
	"max_uses" integer DEFAULT 1,
	"current_uses" integer DEFAULT 0,
	"expires_at" bigint NOT NULL,
	"created_at" bigint DEFAULT 0,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "access_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "access_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"granted_by" text NOT NULL,
	"item_type" varchar(20) NOT NULL,
	"item_id" text NOT NULL,
	"reason" text DEFAULT '',
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"admin_name" text DEFAULT '',
	"action" varchar(50) NOT NULL,
	"target_type" varchar(50) DEFAULT '',
	"target_id" text DEFAULT '',
	"target_name" text DEFAULT '',
	"changes" jsonb,
	"ip_address" text DEFAULT '',
	"user_agent" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" varchar(50) DEFAULT '',
	"model" text DEFAULT '',
	"prompt" text NOT NULL,
	"response" text DEFAULT '',
	"tokens_used" integer DEFAULT 0,
	"duration_ms" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'completed',
	"error_message" text DEFAULT '',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "announcement_ads" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" varchar(20) DEFAULT 'banner',
	"position" varchar(20) DEFAULT 'top',
	"image_url" text DEFAULT '',
	"link_url" text DEFAULT '',
	"target_roles" text[] DEFAULT '{}',
	"target_paths" text[] DEFAULT '{}',
	"start_date" timestamp,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "b2b_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"course_ids" text[] DEFAULT '{}',
	"content_types" text[] DEFAULT '{"all"}',
	"path_ids" text[] DEFAULT '{}',
	"subject_ids" text[] DEFAULT '{}',
	"type" varchar(20) DEFAULT 'free_access',
	"discount_percentage" integer,
	"max_students" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active',
	"created_at" bigint DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "backup_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_id" text,
	"action" varchar(50) NOT NULL,
	"description" text DEFAULT '',
	"status" varchar(20) DEFAULT 'completed',
	"details" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "backup_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"type" varchar(20) DEFAULT 'manual',
	"status" varchar(20) DEFAULT 'completed',
	"size" text DEFAULT '',
	"table_count" integer DEFAULT 0,
	"record_count" integer DEFAULT 0,
	"tables" jsonb,
	"file_path" text DEFAULT '',
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"course_title" text NOT NULL,
	"certificate_number" text NOT NULL,
	"verification_code" text NOT NULL,
	"issued_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "certificates_certificate_number_unique" UNIQUE("certificate_number"),
	CONSTRAINT "certificates_verification_code_unique" UNIQUE("verification_code")
);
--> statement-breakpoint
CREATE TABLE "client_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT '',
	"event_type" varchar(50) NOT NULL,
	"event_name" text DEFAULT '',
	"page_url" text DEFAULT '',
	"metadata" jsonb,
	"user_agent" text DEFAULT '',
	"ip_address" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"thumbnail" text DEFAULT '',
	"instructor" text NOT NULL,
	"price" integer DEFAULT 0,
	"currency" text DEFAULT 'SAR',
	"duration" integer DEFAULT 0,
	"level" varchar(20) DEFAULT 'Beginner',
	"rating" integer DEFAULT 0,
	"progress" integer DEFAULT 0,
	"category" text DEFAULT '',
	"subject" text DEFAULT '',
	"path_id" text,
	"subject_id" text,
	"section_id" text,
	"features" text[] DEFAULT '{}',
	"description" text DEFAULT '',
	"instructor_bio" text DEFAULT '',
	"modules" jsonb DEFAULT '[]'::jsonb,
	"is_published" boolean DEFAULT false,
	"show_on_platform" boolean DEFAULT true,
	"is_package" boolean DEFAULT false,
	"package_type" varchar(20),
	"package_content_types" text[],
	"original_price" integer,
	"included_courses" text[] DEFAULT '{}',
	"prerequisite_course_ids" text[] DEFAULT '{}',
	"drip_content_enabled" boolean DEFAULT false,
	"certificate_enabled" boolean DEFAULT false,
	"skills" text[] DEFAULT '{}',
	"student_count" integer,
	"weeks_count" integer,
	"preview_video_url" text,
	"files" jsonb DEFAULT '[]'::jsonb,
	"qa" jsonb DEFAULT '[]'::jsonb,
	"owner_type" varchar(20) DEFAULT 'platform',
	"owner_id" text DEFAULT '',
	"created_by" text DEFAULT '',
	"assigned_teacher_id" text DEFAULT '',
	"approval_status" varchar(20) DEFAULT 'draft',
	"approved_by" text DEFAULT '',
	"approved_at" bigint,
	"reviewer_notes" text DEFAULT '',
	"revenue_share_percentage" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" varchar(20) DEFAULT 'percentage' NOT NULL,
	"value" integer NOT NULL,
	"max_uses" integer DEFAULT 0,
	"current_uses" integer DEFAULT 0,
	"min_purchase_amount" integer DEFAULT 0,
	"applicable_course_ids" text[] DEFAULT '{}',
	"applicable_package_ids" text[] DEFAULT '{}',
	"starts_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"parent_id" text,
	"owner_id" text NOT NULL,
	"supervisor_ids" text[] DEFAULT '{}',
	"student_ids" text[] DEFAULT '{}',
	"course_ids" text[] DEFAULT '{}',
	"description" text DEFAULT '',
	"location" text DEFAULT '',
	"settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "homepage_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"path_id" text,
	"subject_id" text,
	"section_id" text,
	"type" varchar(20) NOT NULL,
	"duration" text DEFAULT '',
	"content" text DEFAULT '',
	"video_url" text DEFAULT '',
	"file_url" text DEFAULT '',
	"meeting_url" text DEFAULT '',
	"meeting_date" text DEFAULT '',
	"recording_url" text DEFAULT '',
	"join_instructions" text DEFAULT '',
	"show_recording_on_platform" boolean DEFAULT false,
	"show_on_platform" boolean DEFAULT true,
	"quiz_id" text,
	"order" integer DEFAULT 0,
	"is_locked" boolean DEFAULT false,
	"skill_ids" text[] DEFAULT '{}',
	"owner_type" varchar(20) DEFAULT 'platform',
	"owner_id" text DEFAULT '',
	"created_by" text DEFAULT '',
	"assigned_teacher_id" text DEFAULT '',
	"approval_status" varchar(20) DEFAULT 'draft',
	"approved_by" text DEFAULT '',
	"approved_at" bigint,
	"reviewer_notes" text DEFAULT '',
	"revenue_share_percentage" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"id" text PRIMARY KEY NOT NULL,
	"path_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_items" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"size" text DEFAULT '',
	"downloads" integer DEFAULT 0,
	"type" varchar(20) DEFAULT 'pdf',
	"path_id" text,
	"subject_id" text NOT NULL,
	"section_id" text,
	"skill_ids" text[] DEFAULT '{}',
	"url" text,
	"show_on_platform" boolean DEFAULT true,
	"is_locked" boolean DEFAULT false,
	"owner_type" varchar(20) DEFAULT 'platform',
	"owner_id" text,
	"created_by" text,
	"assigned_teacher_id" text,
	"approval_status" varchar(20) DEFAULT 'draft',
	"approved_by" text,
	"approved_at" bigint,
	"reviewer_notes" text,
	"revenue_share_percentage" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text,
	"template_key" text,
	"user_id" text NOT NULL,
	"recipient_user_id" text,
	"channel" varchar(20) DEFAULT 'in_app' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"title" text DEFAULT '',
	"body" text DEFAULT '',
	"subject" text DEFAULT '',
	"recipient_email" text DEFAULT '',
	"recipient_phone" text DEFAULT '',
	"recipient_role" text DEFAULT '',
	"provider" text DEFAULT '',
	"provider_message_id" text DEFAULT '',
	"failure_reason" text DEFAULT '',
	"retry_count" integer DEFAULT 0,
	"next_attempt_at" timestamp,
	"metadata" jsonb,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"error" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"title" text DEFAULT '',
	"subject" text DEFAULT '',
	"body" text DEFAULT '',
	"channels" text[] DEFAULT '{"in_app"}',
	"subject_template" text DEFAULT '',
	"body_template" text NOT NULL,
	"variables" text[] DEFAULT '{}',
	"enabled" integer DEFAULT 1,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_templates_code_unique" UNIQUE("code"),
	CONSTRAINT "notification_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "paths" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"icon_url" text,
	"icon_style" text,
	"show_in_navbar" boolean DEFAULT true,
	"show_in_home" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"parent_path_id" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text DEFAULT '',
	"user_email" text DEFAULT '',
	"item_type" varchar(20) NOT NULL,
	"item_id" text NOT NULL,
	"item_name" text NOT NULL,
	"package_id" text DEFAULT '',
	"included_course_ids" text[] DEFAULT '{}',
	"amount" integer DEFAULT 0,
	"currency" text DEFAULT 'SAR',
	"payment_method" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"transfer_reference" text DEFAULT '',
	"wallet_number" text DEFAULT '',
	"receipt_url" text DEFAULT '',
	"notes" text DEFAULT '',
	"reviewed_by" text DEFAULT '',
	"reviewed_at" bigint,
	"reviewer_notes" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"bank_name" text,
	"account_name" text,
	"account_number" text,
	"iban" text,
	"wallet_number" text,
	"enable_card" boolean DEFAULT false,
	"enable_transfer" boolean DEFAULT false,
	"enable_wallet" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_integration_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_integration_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "question_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"selected_option_index" integer DEFAULT -1,
	"is_correct" boolean DEFAULT false,
	"time_spent_seconds" integer DEFAULT 0,
	"date" text DEFAULT '',
	"path_id" text DEFAULT '',
	"subject_id" text DEFAULT '',
	"section_id" text DEFAULT '',
	"skill_ids" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text DEFAULT '',
	"options" text[] DEFAULT '{}',
	"correct_option_index" integer DEFAULT 0,
	"explanation" text DEFAULT '',
	"video_url" text DEFAULT '',
	"image_url" text DEFAULT '',
	"skill_ids" text[] DEFAULT '{}',
	"path_id" text,
	"subject" text NOT NULL,
	"section_id" text,
	"difficulty" varchar(20) DEFAULT 'Medium',
	"type" varchar(20) DEFAULT 'mcq',
	"owner_type" varchar(20) DEFAULT 'platform',
	"owner_id" text DEFAULT '',
	"created_by" text DEFAULT '',
	"assigned_teacher_id" text DEFAULT '',
	"approval_status" varchar(20) DEFAULT 'draft',
	"approved_by" text DEFAULT '',
	"approved_at" bigint,
	"reviewer_notes" text DEFAULT '',
	"revenue_share_percentage" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quiz_results" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quiz_id" text NOT NULL,
	"quiz_title" text NOT NULL,
	"score" integer DEFAULT 0,
	"total_questions" integer DEFAULT 0,
	"correct_answers" integer DEFAULT 0,
	"wrong_answers" integer DEFAULT 0,
	"unanswered" integer DEFAULT 0,
	"time_spent" text DEFAULT '',
	"date" text DEFAULT '',
	"skills_analysis" jsonb DEFAULT '[]'::jsonb,
	"question_review" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"path_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"section_id" text,
	"type" varchar(20) DEFAULT 'quiz',
	"mode" varchar(20) DEFAULT 'regular',
	"settings" jsonb DEFAULT '{"showExplanations":true,"showAnswers":true,"maxAttempts":3,"passingScore":60,"timeLimit":60}'::jsonb,
	"access_type" varchar(20) DEFAULT 'free',
	"access_price" integer DEFAULT 0,
	"access_allowed_group_ids" text[] DEFAULT '{}',
	"question_ids" text[] DEFAULT '{}',
	"skill_ids" text[] DEFAULT '{}',
	"target_group_ids" text[] DEFAULT '{}',
	"target_user_ids" text[] DEFAULT '{}',
	"due_date" text,
	"is_published" boolean DEFAULT false,
	"show_on_platform" boolean DEFAULT true,
	"owner_type" varchar(20) DEFAULT 'platform',
	"owner_id" text DEFAULT '',
	"created_by" text DEFAULT '',
	"assigned_teacher_id" text DEFAULT '',
	"approval_status" varchar(20) DEFAULT 'draft',
	"approved_by" text DEFAULT '',
	"approved_at" bigint,
	"reviewer_notes" text DEFAULT '',
	"revenue_share_percentage" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"skill" text DEFAULT '',
	"path_id" text DEFAULT '',
	"subject_id" text DEFAULT '',
	"section_id" text DEFAULT '',
	"mastery" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'weak',
	"attempts" integer DEFAULT 0,
	"last_quiz_id" text DEFAULT '',
	"last_quiz_title" text DEFAULT '',
	"last_attempt_at" timestamp DEFAULT now(),
	"recommended_action" text DEFAULT '',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"path_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"section_id" text NOT NULL,
	"description" text DEFAULT '',
	"lesson_ids" text[] DEFAULT '{}',
	"question_ids" text[] DEFAULT '{}',
	"created_at" bigint DEFAULT 0,
	"updated_at" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"path_id" text NOT NULL,
	"subject_ids" text[] DEFAULT '{}',
	"course_ids" text[] DEFAULT '{}',
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"skip_completed_quizzes" boolean DEFAULT true,
	"off_days" text[] DEFAULT '{}',
	"daily_minutes" integer DEFAULT 90,
	"preferred_start_time" text DEFAULT '17:00',
	"status" varchar(20) DEFAULT 'active',
	"created_at" bigint DEFAULT 0,
	"updated_at" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"path_id" text NOT NULL,
	"level_id" text,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"icon_url" text,
	"icon_style" text,
	"settings" jsonb
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"path_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"section_id" text,
	"title" text NOT NULL,
	"parent_id" text,
	"order" integer DEFAULT 0,
	"show_on_platform" boolean DEFAULT true,
	"is_locked" boolean DEFAULT false,
	"lesson_ids" text[] DEFAULT '{}',
	"quiz_ids" text[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar" text DEFAULT '',
	"role" varchar(20) DEFAULT 'student' NOT NULL,
	"points" integer DEFAULT 0,
	"badges" text[] DEFAULT '{}',
	"subscription_plan" varchar(20) DEFAULT 'free',
	"subscription_expires_at" timestamp,
	"purchased_courses" text[] DEFAULT '{}',
	"purchased_packages" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"is_email_verified" boolean DEFAULT false,
	"email_verification_token" text,
	"email_verification_expires_at" timestamp,
	"password_reset_token" text,
	"password_reset_expires_at" timestamp,
	"school_id" text,
	"group_ids" text[] DEFAULT '{}',
	"linked_student_ids" text[] DEFAULT '{}',
	"managed_path_ids" text[] DEFAULT '{}',
	"managed_subject_ids" text[] DEFAULT '{}',
	"enrolled_courses" text[] DEFAULT '{}',
	"enrolled_paths" text[] DEFAULT '{}',
	"completed_lessons" text[] DEFAULT '{}',
	"favorites" text[] DEFAULT '{}',
	"review_later" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"google_id" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "idx_access_codes_code" ON "access_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_access_codes_school_id" ON "access_codes" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_access_codes_package_id" ON "access_codes" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "idx_access_grants_user_id" ON "access_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_access_grants_item_type" ON "access_grants" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "idx_access_grants_item_id" ON "access_grants" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_activities_user_id" ON "activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activities_type" ON "activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_activities_created_at" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_admin_id" ON "admin_audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_action" ON "admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_target_type" ON "admin_audit_logs" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_created_at" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_user_id" ON "ai_interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_provider" ON "ai_interactions" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_created_at" ON "ai_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_announcement_ads_is_active" ON "announcement_ads" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_announcement_ads_type" ON "announcement_ads" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_announcement_ads_position" ON "announcement_ads" USING btree ("position");--> statement-breakpoint
CREATE INDEX "idx_b2b_packages_school_id" ON "b2b_packages" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_b2b_packages_status" ON "b2b_packages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_backup_activities_snapshot_id" ON "backup_activities" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_backup_activities_action" ON "backup_activities" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_backup_activities_created_at" ON "backup_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_backup_snapshots_status" ON "backup_snapshots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_backup_snapshots_type" ON "backup_snapshots" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_backup_snapshots_created_at" ON "backup_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_certificates_user_id" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_certificates_course_id" ON "certificates" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_certificates_verification_code" ON "certificates" USING btree ("verification_code");--> statement-breakpoint
CREATE INDEX "idx_certificates_certificate_number" ON "certificates" USING btree ("certificate_number");--> statement-breakpoint
CREATE INDEX "idx_client_events_user_id" ON "client_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_events_event_type" ON "client_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_client_events_created_at" ON "client_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_courses_path_id" ON "courses" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_courses_subject_id" ON "courses" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_courses_is_published" ON "courses" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_courses_approval_status" ON "courses" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_courses_owner_type" ON "courses" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "idx_courses_owner_id" ON "courses" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_discount_codes_code" ON "discount_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_discount_codes_is_active" ON "discount_codes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_discount_codes_expires_at" ON "discount_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_groups_type" ON "groups" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_groups_owner_id" ON "groups" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_groups_parent_id" ON "groups" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_path_id" ON "lessons" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_subject_id" ON "lessons" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_quiz_id" ON "lessons" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_approval_status" ON "lessons" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_lessons_owner_type" ON "lessons" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "idx_levels_path_id" ON "levels" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_library_items_path_id" ON "library_items" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_library_items_subject_id" ON "library_items" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_library_items_approval_status" ON "library_items" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_library_items_owner_type" ON "library_items" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_user_id" ON "notification_deliveries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_campaign_id" ON "notification_deliveries" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_status" ON "notification_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_channel" ON "notification_deliveries" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_next_attempt" ON "notification_deliveries" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_notification_templates_key" ON "notification_templates" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_notification_templates_code" ON "notification_templates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_notification_templates_is_active" ON "notification_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_paths_is_active" ON "paths" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_paths_parent_path_id" ON "paths" USING btree ("parent_path_id");--> statement-breakpoint
CREATE INDEX "idx_payment_requests_user_id" ON "payment_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payment_requests_status" ON "payment_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payment_requests_item_type" ON "payment_requests" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "idx_payment_requests_created_at" ON "payment_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_platform_integration_settings_key" ON "platform_integration_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_question_attempts_user_id" ON "question_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_question_attempts_question_id" ON "question_attempts" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_question_attempts_user_question" ON "question_attempts" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "idx_question_attempts_path_id" ON "question_attempts" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_question_attempts_subject_id" ON "question_attempts" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_questions_path_id" ON "questions" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_questions_section_id" ON "questions" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_questions_approval_status" ON "questions" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_questions_owner_type" ON "questions" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "idx_quiz_results_user_id" ON "quiz_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_results_quiz_id" ON "quiz_results" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_results_user_quiz" ON "quiz_results" USING btree ("user_id","quiz_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_results_created_at" ON "quiz_results" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_quizzes_path_id" ON "quizzes" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_quizzes_subject_id" ON "quizzes" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_quizzes_is_published" ON "quizzes" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "idx_quizzes_approval_status" ON "quizzes" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_quizzes_owner_type" ON "quizzes" USING btree ("owner_type");--> statement-breakpoint
CREATE INDEX "idx_sections_subject_id" ON "sections" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_skill_progress_user_id" ON "skill_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_skill_progress_skill_id" ON "skill_progress" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "idx_skill_progress_user_skill" ON "skill_progress" USING btree ("user_id","skill_id");--> statement-breakpoint
CREATE INDEX "idx_skill_progress_path_id" ON "skill_progress" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_skill_progress_subject_id" ON "skill_progress" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_skills_path_id" ON "skills" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_skills_subject_id" ON "skills" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_skills_section_id" ON "skills" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_study_plans_user_id" ON "study_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_study_plans_status" ON "study_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subjects_path_id" ON "subjects" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_subjects_level_id" ON "subjects" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "idx_topics_path_id" ON "topics" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_topics_subject_id" ON "topics" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_topics_parent_id" ON "topics" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_is_active" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_users_school_id" ON "users" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "idx_users_subscription_plan" ON "users" USING btree ("subscription_plan");--> statement-breakpoint
CREATE INDEX "idx_users_email_verification_token" ON "users" USING btree ("email_verification_token");--> statement-breakpoint
CREATE INDEX "idx_users_password_reset_token" ON "users" USING btree ("password_reset_token");