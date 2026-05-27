# Notification System Guide

## Current Status

This sprint adds the backend foundation for production-safe notifications.

Implemented:

- Notification templates with variables.
- Notification delivery logs.
- In-app notifications for students, parents, teachers, supervisors, and admins.
- Email and WhatsApp delivery records as `pending` until a provider is configured.
- Provider adapter for `console`, Resend email, generic email webhook, WhatsApp Cloud API, and generic WhatsApp webhook.
- Admin-only APIs for templates, delivery review, campaign creation, and processing pending messages.
- A hard per-request recipient cap of 500 so bulk messages are batched instead of sent in one huge HTTP request.
- BullMQ/Redis queue support for external delivery jobs.
- Optional worker startup in the API process when Redis is configured.

## API Summary

Student/user:

- `GET /api/notifications/me`
- `PATCH /api/notifications/:id/read`

Admin:

- `GET /api/notifications/admin/templates`
- `POST /api/notifications/admin/templates`
- `GET /api/notifications/admin/deliveries`
- `POST /api/notifications/admin/send`
- `POST /api/notifications/admin/process-pending`

## Delivery States

- `pending`: waiting for external provider processing.
- `sent`: delivered internally or through a configured provider.
- `retrying`: attempted but not ready; will retry later.
- `failed`: exhausted retries or failed permanently.

## Provider Configuration

Current safe provider mode:

```text
EMAIL_PROVIDER=console
WHATSAPP_PROVIDER=console
```

`console` is for testing only. It writes a safe delivery log and marks messages as sent without calling a real provider.

Production email options:

```text
EMAIL_PROVIDER=resend
EMAIL_FROM=Platform <noreply@example.com>
RESEND_API_KEY=...
```

Or use a trusted provider through a webhook adapter:

```text
EMAIL_PROVIDER=http
EMAIL_WEBHOOK_URL=https://provider.example/send-email
EMAIL_WEBHOOK_TOKEN=...
```

Production WhatsApp options:

```text
WHATSAPP_PROVIDER=whatsapp_cloud
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
```

Or:

```text
WHATSAPP_PROVIDER=http
WHATSAPP_WEBHOOK_URL=https://provider.example/send-whatsapp
WHATSAPP_WEBHOOK_TOKEN=...
```

Leave providers empty in production until credentials are ready. Empty providers keep deliveries in retry/failed state instead of pretending they were sent.

## Bulk Sending Rule

Do not send thousands of external messages directly inside a normal web request.

Use this flow:

1. Admin creates a campaign with `POST /api/notifications/admin/send`.
2. In-app records become visible immediately.
3. Email/WhatsApp records stay `pending`.
4. If `REDIS_URL` and `NOTIFICATION_QUEUE_ENABLED=true` are configured, external delivery jobs are pushed to BullMQ.
5. The worker sends through the configured provider adapter with retries and exponential backoff.
6. If Redis is not configured, `POST /api/notifications/admin/process-pending` falls back to small inline batches.

## Redis / BullMQ Configuration

Production queue mode:

```text
REDIS_URL=redis://...
REDIS_KEY_PREFIX=almeaa
NOTIFICATION_QUEUE_ENABLED=true
NOTIFICATION_QUEUE_CONCURRENCY=5
```

Queue behavior:

- Queue name: `notifications`.
- Job name: `deliver-notification`.
- Job id: `delivery:<NotificationDelivery.id>` for idempotency.
- Attempts: 4.
- Backoff: exponential, starting at 60 seconds.
- Completed jobs retained: 1000.
- Failed jobs retained: 5000.
- Worker concurrency defaults to 5 and can be tuned with `NOTIFICATION_QUEUE_CONCURRENCY`.

## Template Variables

Templates support simple variables:

```text
مرحبًا {{name}}، تم تفعيل باقتك {{packageName}}.
```

Variables are provided in the send request as:

```json
{
  "variables": {
    "name": "سلمان",
    "packageName": "الباقة الشاملة"
  }
}
```

## Remaining Production Work

- Add admin UI for message center if the current admin screen needs visual controls.
- Add unsubscribe/preferences rules for non-essential marketing messages.
