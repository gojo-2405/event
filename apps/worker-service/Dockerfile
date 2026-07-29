# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the eventrax-services pnpm monorepo.
#
# IMPORTANT: build with the repository ROOT as the context so the
# workspace packages (packages/*) are available, e.g. from repo root:
#   docker build -f apps/worker-service/Dockerfile -t worker-service .
#
# The service to package is selected with the SERVICE build-arg. Only that
# service and its workspace dependencies are built (not the whole repo), so an
# unrelated service can never break this image.

ARG NODE_VERSION=22
# Declared globally so each stage can opt in with a bare `ARG SERVICE`.
ARG SERVICE=worker-service

# ---------------------------------------------------------------------------
# Builder: install deps, generate the Prisma client, build the target service.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS builder

# openssl + ca-certificates are required by Prisma's query engine.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

# Copy the whole workspace (node_modules/dist are excluded via .dockerignore).
COPY . .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Generate the Prisma client, then build only the target service and the
# workspace packages it depends on ("...<pkg>" = the package + its deps).
ARG SERVICE
RUN pnpm --filter @eventrax/database prisma:generate
RUN pnpm --filter "...@eventrax/${SERVICE}" build

# ---------------------------------------------------------------------------
# Runner: copy the built monorepo (workspace symlinks intact) and run.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
RUN corepack enable

WORKDIR /repo
COPY --from=builder /repo ./

# Which service this image runs.
ARG SERVICE
ENV SERVICE_NAME=${SERVICE}

WORKDIR /repo/apps/${SERVICE}

EXPOSE 3000
CMD ["node", "dist/main.js"]
