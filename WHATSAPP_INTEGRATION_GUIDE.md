# WhatsApp Integration Guide

## Current Status

The platform stores WhatsApp notification delivery records and has a provider adapter for test mode, WhatsApp Cloud API, and a generic HTTP webhook. It does not send real WhatsApp messages until credentials and provider choice are configured.

## Recommended Providers

- WhatsApp Business Cloud API.
- Twilio WhatsApp.
- A trusted local/Saudi provider with official WhatsApp Business support.

## Required Production Values

Typical WhatsApp Cloud API values:

```text
WHATSAPP_PROVIDER=whatsapp_cloud
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

Generic provider/webhook values:

```text
WHATSAPP_PROVIDER=http
WHATSAPP_WEBHOOK_URL=https://provider.example/send-whatsapp
WHATSAPP_WEBHOOK_TOKEN=...
```

Do not commit these values to Git.

## Current Test Mode

For local/staging smoke testing only:

```text
WHATSAPP_PROVIDER=console
```

This marks pending WhatsApp deliveries as sent and logs a safe JSON line without contacting WhatsApp.

## Production Notes

- WhatsApp template messages must be approved by the provider before use.
- OTP and marketing announcements should have separate templates and rate limits.
- Bulk WhatsApp campaigns should run through a queue, not direct HTTP requests.
- Configure `REDIS_URL` and `NOTIFICATION_QUEUE_ENABLED=true` so WhatsApp deliveries are handled by BullMQ workers instead of normal HTTP requests.
- Delivery status webhooks should update `NotificationDelivery` records when the provider sends delivery/read/failure events.
