# "Check your portal" notifications (optional, opt-in)

When you deliver a run to the learner and mentor portals, T.A.C.E can also send a short
email or SMS that says a new plan is waiting. It is **off until you connect a provider**.
Without a key the Studio reports `not_connected` and sends nothing.

## Privacy rules (binding)

- **Opt-in only.** Only people who chose to be contacted are sent anything. The server asks the
  database for contacts with `lms_admin_contacts`, and that function returns only opted-in people.
  The consent capture itself lives in the portal and database, not in this change (see "Not verified").
- **Consent is stored and cleared on reset.** The database holds the consent; `lms_admin_reset` clears audience activity.
- **Coordinator approval is required.** Notifications run only after you press deliver with `confirm: true`.
  They never run on their own.
- **No plan content.** The message is fixed text. It carries the person's own display name and the portal address, nothing else.
- **No addresses in logs.** The ledger and the response carry counts and short error codes only.

The fixed text (from `engine/notify.mjs`):

- Email subject: `New message in your learning portal`
- Email body: `Hi {name}, you have a new plan waiting in your learning portal. Open {PORTAL_URL} and sign in to read it.`
- SMS (160 characters at most): `Hi {name}, you have a new plan in your learning portal. Open {PORTAL_URL} and sign in to read it.`

## Set up (owner steps)

1. Create a free Brevo account at https://www.brevo.com.
2. Verify one sender email address (Brevo asks you to confirm it). That address is `NOTIFY_FROM_EMAIL`.
3. Create an API key in your Brevo account settings (the API keys section; the menu names may differ). Copy it once.
4. Open `repo/.env` (git-ignored) and add these lines. Put in your own values, never paste them into a chat:
   ```
   BREVO_API_KEY=<your key>
   NOTIFY_FROM_EMAIL=<the verified sender address>
   PORTAL_URL=<the address learners open, for example the portal's web address>
   ```
   `NOTIFY_FROM_NAME` is optional (default `Learning Portal`).
5. Restart the Studio server (`npm run studio`). Check `GET /api/lms/status`: `notify.email.connected` should be `true`.

**SMS** is optional and costs money. It needs Brevo SMS credits on the account, plus:

```
NOTIFY_SMS_SENDER=<up to 11 letters or digits, for example TACE>
```

Without credits, SMS sends fail with the Brevo code shown in the response. Email is unaffected.

## Deliver with or without notifications

`POST /api/runs/:id/deliver` takes `{"confirm": true}` (notifications on, the default) or
`{"confirm": true, "notify": false}` to deliver to the inboxes only. The response `notify` block:

```
notify: { email: 'sent' | 'partial' | 'failed' | 'not_connected' | 'skipped',
          sms:   '...same values...',
          counts: { email: {sent, failed}, sms: {sent, failed} },
          errors: { email: {CODE: n}, sms: {CODE: n} } }
```

`partial` means some sends failed; `failed` means all attempted sends failed. An inbox delivery
that succeeded is never undone by a notification failure. The response then carries `notify.error`.

## Brevo request shapes (verified against the public docs)

Fetched 13 Nov 2026 from developers.brevo.com (`/reference/send-transac-email` and the SMS
reference, as `.md`).

Email, from the "Send a transactional email" page:

> POST https://api.brevo.com/v3/smtp/email
> Content-Type: application/json

> `api-key` header (required) — The API key should be passed in the request headers as `api-key` for authentication.

> `sender` (SmtpEmailPostRequestBodyContentApplicationJsonSchemaSender, optional) — Sender information. Required when `templateId` is not provided.

> `subject` (string, optional) — Email subject line. Required when `templateId` is not provided.

We send `{ sender: {email, name}, to: [{email}], subject, textContent }`. Brevo returns 201 with `messageId`.

SMS, from the "Send SMS message to a mobile number" page:

> POST https://api.brevo.com/v3/transactionalSMS/sms
> Content-Type: application/json

> `sender` (string, required) — Name of the sender. **The number of characters is limited to 11 for alphanumeric characters and 15 for numeric characters.**

> `recipient` (string, required) — Mobile number to send SMS with the country code. Must contain between 6 and 15 digits, optionally prefixed with '+'.

> `content` (string, optional) — Content of the message. If more than **160 characters** long, will be sent as multiple text messages.

We send `{ sender, recipient, content, type: 'transactional', unicodeEnabled }`. The SMS endpoints page
names the same operation as `https://api.brevo.com/v3/transactionalSMS/send`. We use `/sms` because
that is the page the brief names.

Retries: one retry on HTTP 429 or 5xx. Timeout: 10 seconds per request. Errors show a short code only,
and the API key is removed from any text.

## Not verified (honest limits)

- **Not sent to a real inbox or phone.** Every test uses a fake fetch. No real Brevo request has been made, and no key was used.
- **Consent capture is not in this change.** The "opt in" screen and the consent table belong to the portal/database
  side. The code trusts `lms_admin_contacts` to return only opted-in people.
- **Brevo's rate limits and SMS pricing** are not checked here; the docs above do not state numbers we rely on.
- **Unicode SMS** is sent as one message up to 160 characters as the brief asks. Carriers split non-ASCII SMS at 70
  characters, so a long name with accents may cost more than one SMS.
- **Sender verification and domain authentication** (SPF/DKIM) are the owner's Brevo setup; the code cannot check them.
