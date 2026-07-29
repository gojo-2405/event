# Eventrax Role And Permission Matrix

This matrix is derived from:

- `Scope Definition _Tenant_Req.docx`
- `Scope Definition _ AOK_Req.docx`
- `E20-18` Jira acceptance intent

It is the current engineering proposal for implementation.

## Roles

- `aok_admin`
- `aok_manager`
- `cem`
- `tenant_admin`
- `requestor`
- `delegate_booker`
- `guest`
- `freemium_user`
- `platform_admin`

## Permission Model

- `users.read`
- `users.manage`
- `tenant.config.read`
- `tenant.config.manage`
- `events.read`
- `events.manage`
- `inventory.upload`
- `inventory.publish`
- `inventory.defer`
- `inventory.restrict`
- `bookings.read`
- `bookings.manage`
- `approvals.review`
- `enquiries.submit`
- `enquiries.read`
- `notifications.manage`
- `audit.read`
- `platform.override`

## Role Mapping Rationale

- `AOK Admin` comes directly from the AOK requirements and owns tenant onboarding, configuration, upload, and override capability.
- `AOK Manager` is referenced in operational review/escalation style workflows and is modeled as a non-platform but cross-tenant operational role.
- `CEM` is explicitly responsible for previewing, publishing, deferring, and restricting inventory visibility for the tenant.
- `Tenant Admin` is the tenant-side administrative role for users and configuration-level actions.
- `Requestor` is the base booking role.
- `Delegate Booker` is the delegated booking actor called out in the tenant requirements.
- `Guest` is intentionally non-administrative and not granted application management permissions.
- `Freemium User` is derived from the AOK onboarding requirement that freemium tenants only have enquiry-oriented access.
- `Platform Admin` remains as the highest engineering/platform override role.

## Current Engineering Decision

The previous placeholder role names `delegate` and `aok_sales` have been replaced with:

- `delegate_booker`
- `aok_manager`

This better matches the wording and workflow intent in the source documents.

## Notes

- This matrix is sufficient to continue implementation of `E20-18`.
- Product/business confirmation is still recommended before the ticket is finally marked complete.
- `E20-19` should consume this matrix when tenant-isolation and privileged-access rules are implemented.
