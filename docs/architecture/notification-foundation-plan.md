# Notification Foundation Plan

`E20-21` foundation adds both sides of the notification flow:

- in-app notification persistence
- async email delivery jobs with retry and dead-letter handling

## Data model

- `notification`
  - stores the in-app message shown to the user
- `notification_job`
  - stores async email delivery state, idempotency, retries, and dead-letter outcomes

## API surface

- `POST /api/v1/notifications/dispatch`
  - creates an unread in-app notification and queues an email job
- `GET /api/v1/notifications`
  - lists in-app notifications
- `POST /api/v1/notifications/:id/read`
  - marks an in-app notification as read

## Worker surface

- `POST /api/v1/jobs/notifications/drain`
  - processes due queued/retrying email jobs
- `GET /api/v1/jobs/notifications/dlq`
  - shows dead-lettered jobs
- `GET /api/v1/jobs/health`
  - returns worker queue health

## Delivery rules

- originating dispatch writes DB state first
- email provider failure happens asynchronously in the worker path
- retries progress from `queued` to `retrying`
- after the max attempt count, the job moves to `dead_letter`

## Remaining external dependencies

- final provider implementation such as AWS SES
- branded production templates/copy
- business event wiring from bookings, approvals, invitations, and enquiries into dispatch calls
