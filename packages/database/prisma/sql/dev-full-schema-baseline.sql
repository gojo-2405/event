-- Generated from:
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- Date: 2026-07-21

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "package_type" AS ENUM ('standard', 'vip', 'premium', 'corporate', 'group');

-- CreateEnum
CREATE TYPE "visibility_role" AS ENUM ('owner', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'manager', 'employee', 'guest_coordinator', 'viewer');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('pending', 'pending_approval', 'approved', 'rejected', 'waitlisted', 'confirmed', 'cancelled', 'attended', 'no_show');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "name" VARCHAR,
    "slug" VARCHAR,
    "logo_url" TEXT,
    "primary_color" VARCHAR,
    "is_active" BOOLEAN,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "email" VARCHAR,
    "first_name" VARCHAR,
    "last_name" VARCHAR,
    "role" "user_role",
    "password_hash" VARCHAR,
    "role_id" UUID,
    "is_active" BOOLEAN,
    "sso_subject" VARCHAR,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_delegation" (
    "id" UUID NOT NULL,
    "delegator_id" UUID,
    "delegate_id" UUID,
    "is_active" BOOLEAN,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "event_type" VARCHAR,
    "max_bookings" INTEGER,
    "max_spend" DECIMAL,
    "period" VARCHAR,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_ledger" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "entitlement_id" UUID,
    "booking_id" UUID,
    "direction" VARCHAR,
    "bookings_delta" INTEGER,
    "spend_delta" DECIMAL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "entitlement_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_category" (
    "id" UUID NOT NULL,
    "name" VARCHAR,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue" (
    "id" UUID NOT NULL,
    "name" VARCHAR,
    "address_line1" VARCHAR,
    "address_line2" VARCHAR,
    "city" VARCHAR,
    "country" VARCHAR,
    "postcode" VARCHAR,
    "capacity" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "category_id" UUID,
    "venue_id" UUID,
    "title" VARCHAR,
    "description" TEXT,
    "event_type" VARCHAR,
    "status" VARCHAR,
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "is_invitation_only" BOOLEAN,
    "is_multi_date" BOOLEAN,
    "supplier" VARCHAR,
    "dress_code" VARCHAR,
    "inclusions" VARCHAR,
    "booking_deadline" TIMESTAMPTZ(6),
    "thumbnail_url" VARCHAR,
    "source" VARCHAR,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "unpublished_at" TIMESTAMPTZ(6),
    "force_published" BOOLEAN,
    "underperformance_flag_override" BOOLEAN,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requestor_group" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" VARCHAR NOT NULL,
    "is_restricted" BOOLEAN,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "requestor_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requestor_group_member" (
    "id" UUID NOT NULL,
    "group_id" UUID,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "requestor_group_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item" (
    "id" UUID NOT NULL,
    "event_id" UUID,
    "package_type" "package_type",
    "total_seats" INTEGER,
    "available_seats" INTEGER,
    "unit_price" DECIMAL,
    "supplier" VARCHAR,
    "usage_rules" TEXT,
    "version" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_snapshot" (
    "id" UUID NOT NULL,
    "inventory_item_id" UUID,
    "event_id" UUID,
    "snapshot_at" TIMESTAMPTZ(6),
    "total_seats" INTEGER,
    "available_seats" INTEGER,
    "waitlisted_count" INTEGER,
    "trigger" VARCHAR,

    CONSTRAINT "inventory_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_visibility" (
    "id" UUID NOT NULL,
    "event_id" UUID,
    "user_id" UUID,
    "role" "visibility_role",
    "group_id" UUID,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "event_id" UUID,
    "inventory_item_id" UUID,
    "requester_id" UUID,
    "booked_by_id" UUID,
    "on_behalf_of_id" UUID,
    "seats_requested" INTEGER,
    "purpose" VARCHAR,
    "business_purpose" TEXT,
    "status" "booking_status",
    "waitlist_position" INTEGER,
    "total_cost" DECIMAL,
    "unit_value_per_guest" DECIMAL,
    "cancellation_reason_code" VARCHAR,
    "cancellation_reason_text" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "key" VARCHAR NOT NULL,
    "label" VARCHAR NOT NULL,
    "description" VARCHAR,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screen" (
    "id" UUID NOT NULL,
    "key" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "path" VARCHAR NOT NULL,
    "icon" VARCHAR,
    "section" VARCHAR,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_screen" (
    "role_id" UUID NOT NULL,
    "screen_id" UUID NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_approve" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "role_screen_pkey" PRIMARY KEY ("role_id","screen_id")
);

-- CreateTable
CREATE TABLE "approval_rule" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "event_type" VARCHAR,
    "min_spend" DECIMAL,
    "max_spend" DECIMAL,
    "auto_approve" BOOLEAN,
    "approver_role" VARCHAR,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request" (
    "id" UUID NOT NULL,
    "booking_id" UUID,
    "rule_id" UUID,
    "approver_id" UUID,
    "status" VARCHAR,
    "decision_at" TIMESTAMPTZ(6),
    "comments" TEXT,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "first_name" VARCHAR,
    "last_name" VARCHAR,
    "email" VARCHAR,
    "company" VARCHAR,
    "phone" VARCHAR,
    "dietary_requirements" TEXT,
    "accessibility_needs" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL,
    "booking_id" UUID,
    "guest_id" UUID,
    "status" VARCHAR,
    "rsvp_at" TIMESTAMPTZ(6),
    "reconfirmed" BOOLEAN,
    "reconfirmed_at" TIMESTAMPTZ(6),
    "needs_reconfirmation" BOOLEAN DEFAULT false,
    "token" VARCHAR,
    "token_expires_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "attended" BOOLEAN,
    "attended_at" TIMESTAMPTZ(6),
    "cancellation_reason_code" VARCHAR,
    "cancellation_reason_text" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_audit" (
    "id" UUID NOT NULL,
    "invitation_id" UUID,
    "changed_by_id" UUID,
    "field_changed" VARCHAR,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_at" TIMESTAMPTZ(6),

    CONSTRAINT "invitation_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "submitted_by_id" UUID,
    "assigned_to_id" UUID,
    "crm_ref" VARCHAR,
    "crm_booking_ref" INTEGER,
    "crm_last_sync_at" TIMESTAMPTZ(6),
    "enquiry_type" VARCHAR,
    "category" VARCHAR,
    "purpose" VARCHAR,
    "title" VARCHAR,
    "preferred_date" DATE,
    "preferred_location" VARCHAR,
    "budget" DECIMAL,
    "currency" VARCHAR,
    "tax_amount" DECIMAL,
    "guest_count" INTEGER,
    "notes" TEXT,
    "status" VARCHAR,
    "attachment_urls" TEXT[],
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_proposal" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID,
    "venue_name" VARCHAR,
    "proposed_price" DECIMAL,
    "negotiated_price" DECIMAL,
    "notes" TEXT,
    "is_selected" BOOLEAN,
    "booking_id" UUID,
    "crm_offered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "enquiry_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_dispatch" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "provider" VARCHAR NOT NULL,
    "dispatch_key" VARCHAR NOT NULL,
    "target_mode" VARCHAR NOT NULL,
    "target_contact_ref" INTEGER,
    "crm_ref" VARCHAR,
    "status" VARCHAR NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "next_attempt_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "payload" JSONB,
    "response_payload" JSONB,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "enquiry_dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_inbound_event" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "flow" VARCHAR NOT NULL,
    "external_ref" VARCHAR,
    "idempotency_key" VARCHAR NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "status" VARCHAR NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "next_attempt_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "received_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "crm_inbound_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policy" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "entity" VARCHAR NOT NULL,
    "retain_days" INTEGER NOT NULL,
    "mode" VARCHAR NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "retention_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor" VARCHAR NOT NULL,
    "action" VARCHAR NOT NULL,
    "entity_type" VARCHAR,
    "entity_id" VARCHAR,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "type" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "message" TEXT NOT NULL,
    "status" VARCHAR NOT NULL,
    "metadata" JSONB,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_job" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "tenant_id" UUID,
    "channel" VARCHAR NOT NULL,
    "recipient_email" VARCHAR,
    "template_key" VARCHAR,
    "payload" JSONB,
    "idempotency_key" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "next_attempt_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "screen_key_key" ON "screen"("key");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_dispatch_dispatch_key_key" ON "enquiry_dispatch"("dispatch_key");

-- CreateIndex
CREATE INDEX "enquiry_dispatch_status_next_attempt_at_idx" ON "enquiry_dispatch"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_inbound_event_idempotency_key_key" ON "crm_inbound_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "crm_inbound_event_status_next_attempt_at_idx" ON "crm_inbound_event"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_entity_type_entity_id_idx" ON "audit_log"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notification_tenant_id_user_id_status_idx" ON "notification"("tenant_id", "user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_job_idempotency_key_key" ON "notification_job"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_job_status_next_attempt_at_idx" ON "notification_job"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "notification_job_tenant_id_status_idx" ON "notification_job"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_delegation" ADD CONSTRAINT "user_delegation_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_delegation" ADD CONSTRAINT "user_delegation_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entitlement_ledger" ADD CONSTRAINT "entitlement_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entitlement_ledger" ADD CONSTRAINT "entitlement_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entitlement_ledger" ADD CONSTRAINT "entitlement_ledger_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entitlement_ledger" ADD CONSTRAINT "entitlement_ledger_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event" ADD CONSTRAINT "event_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event" ADD CONSTRAINT "event_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event" ADD CONSTRAINT "event_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requestor_group" ADD CONSTRAINT "requestor_group_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requestor_group_member" ADD CONSTRAINT "requestor_group_member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "requestor_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requestor_group_member" ADD CONSTRAINT "requestor_group_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_snapshot" ADD CONSTRAINT "inventory_snapshot_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_snapshot" ADD CONSTRAINT "inventory_snapshot_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_visibility" ADD CONSTRAINT "event_visibility_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_visibility" ADD CONSTRAINT "event_visibility_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_visibility" ADD CONSTRAINT "event_visibility_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "requestor_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking" ADD CONSTRAINT "booking_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking" ADD CONSTRAINT "booking_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking" ADD CONSTRAINT "booking_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking" ADD CONSTRAINT "booking_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking" ADD CONSTRAINT "booking_booked_by_id_fkey" FOREIGN KEY ("booked_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking" ADD CONSTRAINT "booking_on_behalf_of_id_fkey" FOREIGN KEY ("on_behalf_of_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_screen" ADD CONSTRAINT "role_screen_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_screen" ADD CONSTRAINT "role_screen_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_rule" ADD CONSTRAINT "approval_rule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "approval_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guest" ADD CONSTRAINT "guest_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitation_audit" ADD CONSTRAINT "invitation_audit_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitation_audit" ADD CONSTRAINT "invitation_audit_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enquiry_proposal" ADD CONSTRAINT "enquiry_proposal_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enquiry_proposal" ADD CONSTRAINT "enquiry_proposal_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enquiry_dispatch" ADD CONSTRAINT "enquiry_dispatch_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_job" ADD CONSTRAINT "notification_job_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_job" ADD CONSTRAINT "notification_job_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
