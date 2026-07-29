# Audit Trail Plan

Scope aligned to the current final schema in [`etx.sql`](/Users/sjp/Code/Etx2.0/FinalGit/Documents/etx.sql):

- the schema contains `invitation_audit`
- the schema does not currently contain a generic `audit_logs` table

## Implemented foundation

- reusable invitation-audit diff builder in `@eventrax/database`
- reusable bulk-write helper for `invitation_audit`
- immutable SQL trigger for `invitation_audit` `UPDATE` and `DELETE`
- unit tests covering diff generation and no-op writes
- `booking-service` invitation mutation endpoint now writes invitation audit rows transactionally
- `booking-service` invitation audit read endpoint now exposes audit history
- local `aok_dev` database verification completed for both rejected `UPDATE` and rejected `DELETE`

## Current gap

The Jira AC mentions a broader `AuditLog` row for any material action. With the current SQL, we can fully support immutable invitation audit rows, but not a generic cross-domain audit table without a schema change.

## Recommended next step

Use the implemented booking-service route as the reference path for invitation state changes:

- `PATCH /api/v1/invitations/:id`
- `GET /api/v1/invitations/:id/audit`

If broader audit coverage is required for enquiries, bookings, auth actions, or admin overrides, add a dedicated `audit_log` table to the target schema and then route all material actions through a shared audit writer.
