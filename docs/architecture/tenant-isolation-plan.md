# Tenant Isolation Plan

Source of truth:

- `etx.sql` confirmed as final schema
- `E20-19` Jira scope
- tenant/AOK requirement documents

## Tenant-owned tables

These tables carry `tenant_id` directly and should be protected with tenant RLS policies:

- `app_user`
- `entitlement`
- `entitlement_ledger`
- `event`
- `booking`
- `approval_rule`
- `guest`
- `enquiry`

## Tenant-derived access tables

These tables do not always carry `tenant_id` directly but must still be tenant-safe via joins:

- `inventory_item` via `event`
- `inventory_snapshot` via `event`
- `event_visibility` via `event` or `user`
- `approval_request` via `booking`
- `invitation` via `booking`
- `invitation_audit` via `invitation`
- `enquiry_proposal` via `enquiry` or `booking`
- `user_delegation` via `app_user`

## Shared reference tables

These are reference/platform tables and should not use tenant RLS directly:

- `tenant`
- `event_category`
- `venue`

## Privileged access model

- Default application reads/writes should run with `app.tenant_id` set.
- Platform-level access should be explicit and audited.
- `app.bypass_rls=true` is the conceptual privileged path for AOK/platform operations.
- Privileged reads and writes should be rare, logged, and ideally wrapped in dedicated service methods.

## Current implementation status

- App-layer tenant scoping has started for user reads.
- Shared helper logic now distinguishes tenant-scoped reads from privileged override reads.
- DB-level RLS SQL is scaffolded separately and should be applied before `E20-19` is marked complete.
