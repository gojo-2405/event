import type { AuthRole, PermissionAction } from "@eventrax/contracts";

const roleMatrix: Record<AuthRole, PermissionAction[]> = {
  requestor: ["events.read", "bookings.read", "bookings.manage", "enquiries.submit"],
  delegate_booker: ["events.read", "bookings.read", "bookings.manage", "enquiries.submit"],
  cem: [
    "events.read",
    "bookings.read",
    "bookings.manage",
    "approvals.review",
    "inventory.publish",
    "inventory.defer",
    "inventory.restrict",
    "enquiries.read"
  ],
  tenant_admin: [
    "users.read",
    "users.manage",
    "tenant.config.read",
    "events.read",
    "events.manage",
    "inventory.publish",
    "inventory.defer",
    "inventory.restrict",
    "bookings.read",
    "bookings.manage",
    "approvals.review",
    "enquiries.read",
    "notifications.manage",
    "audit.read"
  ],
  aok_admin: [
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
    "enquiries.read",
    "notifications.manage",
    "audit.read",
    "platform.override"
  ],
  aok_manager: [
    "tenant.config.read",
    "events.read",
    "events.manage",
    "inventory.upload",
    "bookings.read",
    "enquiries.read",
    "notifications.manage",
    "audit.read"
  ],
  guest: [],
  freemium_user: ["enquiries.submit", "enquiries.read"],
  platform_admin: [
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
    "enquiries.read",
    "notifications.manage",
    "audit.read",
    "platform.override"
  ]
};

export function getPermissionsForRole(role: AuthRole): PermissionAction[] {
  return roleMatrix[role];
}

export function getRoleMatrix(): Record<AuthRole, PermissionAction[]> {
  return roleMatrix;
}
