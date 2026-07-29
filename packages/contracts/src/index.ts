import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  version: z.string()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const authRoleSchema = z.enum([
  "requestor",
  "delegate_booker",
  "cem",
  "tenant_admin",
  "aok_admin",
  "aok_manager",
  "guest",
  "freemium_user",
  "platform_admin"
]);

export type AuthRole = z.infer<typeof authRoleSchema>;

export const permissionActionSchema = z.enum([
  "users.read",
  "users.manage",
  "tenant.config.read",
  "tenant.config.manage",
  "events.read",
  "events.manage",
  "inventory.upload",
  "inventory.publish",
  "inventory.defer",
  "inventory.restrict",
  "bookings.read",
  "bookings.manage",
  "approvals.review",
  "enquiries.submit",
  "enquiries.read",
  "notifications.manage",
  "audit.read",
  "platform.override"
]);

export type PermissionAction = z.infer<typeof permissionActionSchema>;

export const sessionClaimsSchema = z.object({
  sub: z.string().min(1),
  tenantId: z.string().uuid(),
  role: authRoleSchema,
  email: z.string().email().optional(),
  permissions: z.array(permissionActionSchema).default([])
});

export type SessionClaims = z.infer<typeof sessionClaimsSchema>;

export const notificationTypeSchema = z.enum([
  "booking_update",
  "invitation_update",
  "approval_request",
  "enquiry_update",
  "system"
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationChannelSchema = z.enum(["in_app", "email"]);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const notificationJobStatusSchema = z.enum([
  "queued",
  "processing",
  "retrying",
  "sent",
  "failed",
  "dead_letter"
]);

export type NotificationJobStatus = z.infer<typeof notificationJobStatusSchema>;

export const notificationDispatchRequestSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  type: notificationTypeSchema,
  title: z.string().min(1).max(160),
  message: z.string().min(1).max(2000),
  templateKey: z.string().min(1).default("eventrax-default"),
  idempotencyKey: z.string().min(1).max(200),
  payload: z.record(z.any()).default({})
});

export type NotificationDispatchRequest = z.infer<typeof notificationDispatchRequestSchema>;

export interface CreateAokPublicEnquiryInput {
  idempotencyKey: string;
  enquirySource: string;
  name: string;
  surname: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  position?: string;
  additionalInformation?: string;
  details: string;
}

export interface CreateAokContactEnquiryInput {
  contactId: number;
  idempotencyKey: string;
  enquirySource: string;
  details: string;
}

export interface AokEnquiryResponse {
  id: number;
}

export interface AokEnquiryDetails {
  id: number;
  enquirySource: string;
  contactId: number;
  bookingId?: number;
  details: string;
  created?: string;
  dealtWith?: string;
}

export interface AokEnquiryWebhookPayload {
  action?: "Ignored" | "BookingSpawned";
  enquiryId?: number;
  bookingId?: number;
}
