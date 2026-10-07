# Specification 003 — External Notifications Integration (Email & SMS)

**Status:** Deferred Pending Provider Credentials  
**Closes Scope:** `Scope of work.md:36, 123, 124` (Email and SMS notifications)  
**Priority:** Medium (In-app notifications currently active; external dispatch deferred)  

---

## 1. Problem Statement

Plan 006 implemented the in-app notification system (`notifications` table, unread badges, alert categories).

However, `Scope of work.md` lines 36, 123, and 124 specify:
* "Email and SMS notifications"
* "SMS reminders"
* "Email notifications"

Currently, these external dispatches are deferred because no live SMS (Twilio) or transactional email (SendGrid/Resend) API keys are configured in the environment.

---

## 2. Proposed Changes

### A. Environment Configuration (`backend/app/core/config.py`)
Add optional configuration keys:
```python
# External Notification Providers
TWILIO_ACCOUNT_SID: Optional[str] = None
TWILIO_AUTH_TOKEN: Optional[str] = None
TWILIO_FROM_NUMBER: Optional[str] = None

SENDGRID_API_KEY: Optional[str] = None
SENDGRID_FROM_EMAIL: Optional[str] = "notifications@caregiverplatform.com"
```

### B. Notification Dispatcher Service (`backend/app/services/notifications/`)
1. Create pluggable provider adapters:
   * `email_provider.py`: Wraps SendGrid/Resend client. Falls back to console log in development or when API key is missing.
   * `sms_provider.py`: Wraps Twilio client. Falls back to console log in development.
2. Update `notify()` in `backend/app/utils/notifications.py`:
   * Always write to `notifications` table (in-app feed).
   * If user has verified phone and category is high urgency (`credential_expiring`, `authorization_expiring`), queue SMS dispatch.
   * If user has verified email, send formatted email template.

---

## 3. Activation Checklist

- [ ] Obtain Twilio Account SID, Auth Token, and 10DLC approved phone number.
- [ ] Obtain SendGrid or Resend API key and verify sending domain DNS records.
- [ ] Enable SMS and Email delivery flags in production environment variables.
