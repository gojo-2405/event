# Dev Environment Reference

Last updated: July 22, 2026

This file keeps the current development environment values for the Eventrax frontend and backend services in one place.

## Frontend

File: `eventrax-2.0/.env`

```env
VITE_API_BASE_URL=https://api-gateway-dev.kaaylabs.com/api
VITE_EVENT_API_BASE_URL=https://api-gateway-dev.kaaylabs.com/api
VITE_DISABLE_AUTH=false

VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY="AIzaSyBmvJph4LmrbtW7skeczzpBIyb9WWzFKo4"
VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID="36bde53790372cf1e0360e4590277a32"
```

Notes:
- Frontend should call only `api-gateway`.
- `VITE_API_BASE_URL` and `VITE_EVENT_API_BASE_URL` both point to the gateway in deployed dev.

## API Gateway

File: `eventrax-services/apps/api-gateway/.env`

```env
NODE_ENV=development
SERVICE_NAME=api-gateway
PORT=3000
LOG_LEVEL=info
OTEL_ENABLED=false

DATABASE_URL=postgresql://developer_write:Developer%400321@dev-eventrax.cn0owcy2sefu.eu-west-2.rds.amazonaws.com:5432/eventrax-dev?sslmode=require

AUTH_DEBUG_BYPASS=false
JWT_ISSUER=https://api-auth-dev.kaaylabs.com
JWT_AUDIENCE=eventrax-api
JWT_SECRET=change-me

AUTH_SERVICE_BASE_URL=https://api-auth-dev.kaaylabs.com
EVENT_SERVICE_BASE_URL=https://api-event-dev.kaaylabs.com
BOOKING_SERVICE_BASE_URL=https://api-booking-dev.kaaylabs.com
```

## Auth Service

File: `eventrax-services/apps/auth-service/.env`

```env
NODE_ENV=development
SERVICE_NAME=auth-service
PORT=3001
LOG_LEVEL=info
OTEL_ENABLED=false

DATABASE_URL=postgresql://developer_write:Developer%400321@dev-eventrax.cn0owcy2sefu.eu-west-2.rds.amazonaws.com:5432/eventrax-dev?sslmode=require

AUTH_DEBUG_BYPASS=false
JWT_ISSUER=https://api-auth-dev.kaaylabs.com
JWT_AUDIENCE=eventrax-api
JWT_SECRET=change-me
```

## Booking Service

File: `eventrax-services/apps/booking-service/.env`

```env
NODE_ENV=development
SERVICE_NAME=booking-service
PORT=3003
LOG_LEVEL=info
OTEL_ENABLED=false

DATABASE_URL=postgresql://developer_write:Developer%400321@dev-eventrax.cn0owcy2sefu.eu-west-2.rds.amazonaws.com:5432/eventrax-dev?sslmode=require

AOK_API_BASE_URL=https://alpha.aokevents.com
AOK_API_KEY=aok_alpha_BCb_fxDUJC-aEwo14Zwgh6gl_B2hdP6jkvoeaheAQV8
AOK_WEBHOOK_SECRET=ZzIEMKweZY8IIXdAPkjZznvK9FmTSwKVHzkkGNSe0hc
AOK_ENQUIRY_SOURCE_DEFAULT=Eventrax
ENQUIRY_DEFAULT_CURRENCY=GBP
```

## Event Service

File: `eventrax-services/apps/event-service/.env`

```env
NODE_ENV=development
SERVICE_NAME=event-service
PORT=3004
LOG_LEVEL=info
OTEL_ENABLED=false

DATABASE_URL=postgresql://developer_write:Developer%400321@dev-eventrax.cn0owcy2sefu.eu-west-2.rds.amazonaws.com:5432/eventrax-dev?sslmode=require

JWT_ISSUER=https://api-auth-dev.kaaylabs.com
JWT_AUDIENCE=eventrax-api
JWT_SECRET=change-me
```

## Worker Service

File: `eventrax-services/apps/worker-service/.env`

```env
NODE_ENV=development
SERVICE_NAME=worker-service
PORT=3005
LOG_LEVEL=info
OTEL_ENABLED=false

DATABASE_URL=postgresql://developer_write:Developer%400321@dev-eventrax.cn0owcy2sefu.eu-west-2.rds.amazonaws.com:5432/eventrax-dev?sslmode=require

JWT_ISSUER=https://api-auth-dev.kaaylabs.com
JWT_AUDIENCE=eventrax-api
JWT_SECRET=change-me

AOK_API_BASE_URL=https://alpha.aokevents.com
AOK_API_KEY=aok_alpha_BCb_fxDUJC-aEwo14Zwgh6gl_B2hdP6jkvoeaheAQV8
AOK_WEBHOOK_SECRET=ZzIEMKweZY8IIXdAPkjZznvK9FmTSwKVHzkkGNSe0hc
AOK_ENQUIRY_SOURCE_DEFAULT=Eventrax
AOK_ENQUIRY_DRAIN_INTERVAL_SECONDS=15
AOK_INTEGRATION_DRAIN_INTERVAL_SECONDS=15
ENQUIRY_DEFAULT_CURRENCY=GBP
GDPR_RETENTION_ENABLED=false

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=purusothaman.selvaraj@kaaylabs.com
SMTP_PASSWORD=<gmail-app-password>
SMTP_FROM_EMAIL=purusothaman.selvaraj@kaaylabs.com
SMTP_FROM_NAME=Eventrax
```

## Shared Notes

- All backend services must use the same `JWT_SECRET`, `JWT_ISSUER`, and `JWT_AUDIENCE`.
- Replace `JWT_SECRET=change-me` with a real shared secret before real dev deployment.
- Replace `SMTP_PASSWORD` with a Google App Password, not the normal Gmail password.
- Frontend dev domain:
  - `https://dev-eventrax.kaaylabs.com`
- Main backend domains:
  - `https://api-gateway-dev.kaaylabs.com`
  - `https://api-auth-dev.kaaylabs.com`
  - `https://api-booking-dev.kaaylabs.com`
  - `https://api-event-dev.kaaylabs.com`
  - `https://api-worker-dev.kaaylabs.com`
