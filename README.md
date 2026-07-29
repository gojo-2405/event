# Eventrax Services

Production-grade backend monorepo for Eventrax using:

- Fastify
- TypeScript
- Zod
- OpenTelemetry
- Prisma
- PostgreSQL
- pnpm workspaces

## Services

- `api-gateway`: edge routing, auth enforcement, and shared HTTP concerns
- `auth-service`: users, tenant access, delegation, entitlement primitives
- `event-service`: events, venues, inventory, visibility
- `booking-service`: bookings, approvals, guests, invitations, enquiries
- `worker-service`: async jobs, scheduled work, messaging consumers

## Shared packages

- `@eventrax/config`: environment parsing with Zod
- `@eventrax/logger`: Pino logger factory
- `@eventrax/database`: Prisma client and schema
- `@eventrax/observability`: OpenTelemetry bootstrap helpers
- `@eventrax/contracts`: shared API and domain contracts
- `@eventrax/testing`: test helpers
- `@eventrax/utils`: small generic helpers

## Folder structure

The repository standard is documented in:

- `docs/architecture/folder-structure.md`

In short:

- `apps/` contains deployable services
- `packages/` contains shared workspace libraries
- `packages/database/` is the central place for Prisma schema and SQL foundations
- `tests/` is reserved for cross-service suites
- empty per-service `migrations/` and `openapi/` folders should not be kept unless actively used

## Database model

The initial Prisma schema is derived from `etx.sql`, with the domain split intended to support separate services over time while still allowing a pragmatic shared database start.

## Next steps

1. Run `pnpm install`
2. Run `pnpm db:generate`
3. Decide whether the first deployable slice is `auth-service` or `event-service`
4. Add migrations and service-specific modules incrementally
