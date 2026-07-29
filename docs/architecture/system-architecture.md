# System Architecture

This diagram reflects the current runtime shape of the repository as implemented today.

## Overview

```mermaid
flowchart LR
    user["Clients / Admin UIs / Integrations"]

    subgraph edge["Edge Layer"]
        gateway["api-gateway\nFastify\nCORS / Helmet / shared HTTP concerns"]
    end

    subgraph services["Application Services"]
        auth["auth-service\nIdentity, JWT issuance,\nauthorization, tenant access"]
        event["event-service\nEvents, venues,\ninventory visibility"]
        booking["booking-service\nBookings, invitations,\nnotifications, enquiries"]
        worker["worker-service\nBackground drains,\nretries, DLQ handling"]
    end

    subgraph shared["Shared Workspace Packages"]
        config["@eventrax/config\nEnv loading + AOK client"]
        contracts["@eventrax/contracts\nShared schemas and types"]
        logger["@eventrax/logger\nPino logger factory"]
        obs["@eventrax/observability\nOpenTelemetry bootstrap"]
        dbpkg["@eventrax/database\nPrisma client,\ntenant context,\naudit helpers"]
    end

    subgraph data["Data Plane"]
        postgres[("PostgreSQL\nShared operational database")]
        queue[("DB-backed work queues\nnotification_job,\nenquiry_dispatch")]
    end

    subgraph external["External Systems"]
        workos["WorkOS SSO\nlogin redirect / future code exchange"]
        aok["AOK Events API\nEnquiry dispatch + webhook callbacks"]
        otel["OTLP Collector / Observability Backend"]
        email["Email Provider\ncurrently mocked in worker"]
    end

    user --> gateway
    user --> auth
    user --> event
    user --> booking
    user --> worker

    gateway -. edge routing / auth boundary .-> auth
    gateway -. edge routing / auth boundary .-> event
    gateway -. edge routing / auth boundary .-> booking

    auth --> workos
    auth --> postgres
    auth --> otel

    event --> postgres
    event --> otel

    booking --> postgres
    booking --> queue
    booking --> otel
    aok --> booking

    worker --> postgres
    worker --> queue
    worker --> aok
    worker --> email
    worker --> otel

    gateway --> config
    gateway --> logger
    gateway --> obs
    gateway --> contracts

    auth --> config
    auth --> logger
    auth --> obs
    auth --> contracts
    auth --> dbpkg

    event --> config
    event --> logger
    event --> obs
    event --> dbpkg

    booking --> config
    booking --> logger
    booking --> obs
    booking --> contracts
    booking --> dbpkg

    worker --> config
    worker --> logger
    worker --> obs
    worker --> contracts
    worker --> dbpkg
```

## What The Diagram Shows

- `api-gateway` is the edge-facing Fastify service for shared HTTP concerns. It is present as the intended entry point, although upstream proxying to the other services is not implemented yet.
- `auth-service` owns authentication and authorization concerns, including JWT issuance/verification, permission resolution, and SSO entry points.
- `event-service` owns event-domain reads today and is positioned to hold event lifecycle, venue, and inventory capabilities.
- `booking-service` owns booking-adjacent synchronous APIs, including invitations, notifications, and enquiry orchestration.
- `worker-service` owns asynchronous processing. Today it drains database-backed notification and enquiry jobs, applies retries, and manages dead-letter behavior.
- All deployable services share the same PostgreSQL database through `@eventrax/database` and Prisma.
- Queueing is currently implemented inside PostgreSQL tables rather than a separate broker. The main queues visible in code are `notificationJob` and `enquiryDispatch`.
- Observability is bootstrapped per service through `@eventrax/observability` and exports to an OTLP-compatible backend when enabled.

## Domain Ownership By Data Area

- Identity and access: `Tenant`, `AppUser`, `UserDelegation`, `Entitlement`, `EntitlementLedger`
- Events and inventory: `Event`, `Venue`, `EventCategory`, `InventoryItem`, `InventorySnapshot`, `EventVisibility`
- Bookings and approvals: `Booking`, `ApprovalRule`, `ApprovalRequest`
- Guests and invitations: `Guest`, `Invitation`, `InvitationAudit`
- Messaging and async work: `Notification`, `NotificationJob`
- CRM-style enquiries: `Enquiry`, `EnquiryDispatch`, `EnquiryProposal`

## Current-State Notes

- Service boundaries are clear in code, but persistence is still centralized in one shared database.
- `auth-service` exposes a WorkOS login URL, while the full WorkOS code-exchange path is still a placeholder.
- `worker-service` currently uses a mock email provider abstraction; the integration boundary is present even though a production provider is not wired in yet.
- `booking-service` receives AOK webhook callbacks, while `worker-service` performs outbound AOK enquiry dispatch.
