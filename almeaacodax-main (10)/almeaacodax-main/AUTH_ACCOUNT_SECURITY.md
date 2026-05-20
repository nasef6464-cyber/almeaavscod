# Auth Account Security

## Current Status

This sprint closes the first production account-recovery foundation.

Implemented:

- Registration creates an email verification token.
- Verification tokens are stored as SHA-256 hashes, not plain text.
- Password reset tokens are stored as SHA-256 hashes, not plain text.
- Forgot-password responses are generic to reduce account enumeration.
- Reset tokens expire after 60 minutes and are cleared after use.
- Email verification tokens expire after 24 hours.
- Verification and reset messages are queued through the notification delivery system.
- Registration, admin-created users, and password reset now require at least 8 characters with one letter and one number.
- Repeated failed login attempts are counted on the user record and lock login temporarily after 5 failures.
- Successful login and password reset clear failed login attempts and lock state.
- No email provider secret is committed to Git.

## API Endpoints

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/email/verify`
- `POST /api/auth/email/resend-verification`

## Frontend Routes

- `/#/forgot-password`
- `/#/reset-password?token=...`
- `/#/verify-email?token=...`

The login modal links to the password recovery screen. Reset and verification screens can accept a token from the URL or from a manual paste field.

## Provider Behavior

The backend queues email delivery records. Real email delivery depends on configuring an email provider adapter later.

For staging-only testing:

```text
EMAIL_PROVIDER=console
```

For production, configure one of the delivery providers:

```text
EMAIL_PROVIDER=resend
EMAIL_FROM=Platform <noreply@example.com>
RESEND_API_KEY=...
```

Or:

```text
EMAIL_PROVIDER=http
EMAIL_WEBHOOK_URL=https://provider.example/send-email
EMAIL_WEBHOOK_TOKEN=...
```

## Remaining Work

- Add optional Google OAuth after provider credentials are ready.
- Move sessions to HttpOnly Secure SameSite cookies in a later auth-hardening sprint.
