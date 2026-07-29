# Auth Foundation Plan

This repo is currently being prepared for these Jira stories:

- `E20-18` RBAC architecture + role matrix
- `E20-19` Permission system + tenant isolation
- `E20-20` Auth middleware (JWT/SSO + role context)

## Setup completed first

- monorepo scaffold created
- `auth-service` Fastify starter created
- shared config/logger/observability/database packages created
- local development DB config added in `.env.local`
- auth roles, permission action types, and session claim schemas added
- debug auth plugin added for local role/tenant context simulation
- initial authorization service scaffolding added

## Immediate next build order

1. `E20-20`
   Build identity/session plumbing first.
   - WorkOS config loader
   - SSO callback handlers
   - JWT/session issuer
- protected route middleware
- `/api/v1/auth/me` based on real token claims

2. `E20-18`
   Make RBAC concrete.
   - finalize canonical role list with product/team
   - expand permission matrix
   - add matrix-driven guards
   - add unit tests for allow/deny behavior

3. `E20-19`
   Enforce tenant isolation end to end.
   - Prisma transaction helpers for tenant context
   - Postgres RLS migration SQL
   - BYPASSRLS audit path
   - integration tests proving cross-tenant denial

## Current limitation

The current auth plugin is intentionally a development bootstrap only.
It reads debug headers when `AUTH_DEBUG_BYPASS=true`:

- `x-etx-user-id`
- `x-etx-tenant-id`
- `x-etx-role`
- `x-etx-email`

This is only to unblock local wiring until the real JWT/SSO implementation for `E20-20` is added.
