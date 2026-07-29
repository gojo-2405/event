# Eventrax Services Folder Structure

This repository uses a production-grade monorepo layout with clear boundaries between deployable services, shared libraries, infrastructure, and documentation.

## Top-level structure

```text
eventrax-services/
├── apps/                  # Deployable services
├── packages/              # Shared workspace libraries
├── docs/                  # Architecture, ADRs, runbooks, onboarding
├── infra/                 # Deployment and infrastructure assets
├── tests/                 # Cross-service e2e / contract / security suites
├── tools/                 # Code generation and developer tooling
├── .github/               # CI/CD workflows and templates
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Service structure standard

Every service under `apps/<service-name>` should follow this shape:

```text
apps/<service-name>/
├── src/
│   ├── bootstrap/         # Fastify plugins, server boot wiring
│   ├── modules/           # Business capabilities grouped by module
│   │   └── <module>/
│   │       ├── application/
│   │       ├── domain/
│   │       ├── infrastructure/
│   │       └── presentation/http/
│   ├── shared/            # Shared helpers local to the service
│   │   ├── errors/
│   │   ├── helpers/
│   │   └── types/
│   ├── app.ts             # Fastify app builder
│   └── main.ts            # Process entrypoint
├── test/
│   ├── integration/
│   ├── unit/
│   └── fixtures/
├── package.json
├── tsconfig.json
└── README.md
```

## Shared package structure standard

```text
packages/<package-name>/
├── src/
├── test/                  # Only when the package has direct tests
├── prisma/                # Database package only
├── package.json
├── tsconfig.json
└── README.md
```

## Repository rules

- Keep service-specific code in `apps/`.
- Keep reusable code in `packages/`.
- Keep Prisma schema, SQL foundations, and future DB migrations centralized in `packages/database/`.
- Do not create per-service `migrations/` folders unless a service owns its own datastore.
- Do not keep empty `openapi/` folders; add them only when specs are actually generated or maintained.
- Do not commit `dist/`, `coverage/`, `.DS_Store`, or local generated artifacts.

## Current recommendation for Eventrax

- `auth-service` should continue using the richer module layout already present.
- `booking-service` and `worker-service` should grow toward the same `bootstrap/modules/shared` pattern as new tickets are implemented.
- `api-gateway` and `event-service` can remain minimal until business modules are added, but should adopt the same standard as soon as feature work starts.
