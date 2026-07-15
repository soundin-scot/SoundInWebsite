# Contact and newsletter operations

The public forms run through server-rendered Astro routes on Vercel. Browser code never receives provider credentials.

## Ownership

- Airtable is the source of truth for website enquiries and consent records.
- Resend sends internal notifications and newsletter email, and owns delivery suppression and unsubscribe preferences.
- Vercel runs the endpoints and stores environment variables.

## Airtable base

Create two tables. Field names are part of the API contract and must match exactly.

### Enquiries

| Field | Airtable type |
| --- | --- |
| Name | Single line text (primary) |
| Email | Email |
| Company | Single line text |
| Message | Long text |
| Source | Single line text |
| Status | Single select with `New`, `In progress`, `Closed` |
| Submitted At | Date with time |
| Notification Status | Single select with `Pending`, `Sent`, `Failed` |
| Notification Email ID | Single line text |

### Subscribers

| Field | Airtable type |
| --- | --- |
| Email | Email (primary, unique by operating convention) |
| Status | Single select with `Pending`, `Active`, `Confirmation failed`, `Unsubscribed`, `Bounced`, `Complained`, `Suppressed` |
| Source | Single line text |
| Consent Requested At | Date with time |
| Consent Confirmed At | Date with time |
| Confirmation Token Hash | Single line text |
| Confirmation Expires At | Date with time |
| Confirmation Email ID | Single line text |
| Resend Contact ID | Single line text |
| Last Event At | Date with time |
| Last Webhook ID | Single line text |

Create a Personal Access Token restricted to this base with only the record read/write scopes required by the website. Record the base ID and both table IDs in Vercel; do not use table display names as configuration.

## Resend

1. Verify the SoundIn sending domain.
2. Create a Segment for SoundIn Notes.
3. Create a Topic for SoundIn Notes preferences.
4. Add a webhook pointing to `https://www.soundin.scot/api/webhooks/resend`.
5. Subscribe the webhook to `contact.updated`, `contact.deleted`, `email.bounced`, `email.complained`, and `email.suppressed`.
6. Store the webhook signing secret in `RESEND_WEBHOOK_SECRET`.

The webhook signature is verified before Airtable is updated. Repeated and out-of-order provider events are ignored using the webhook ID and event timestamp.

## Newsletter lifecycle

1. Signup creates or refreshes a `Pending` Airtable record.
2. Resend sends a 24-hour opaque confirmation link.
3. The link opens a review page; it does not subscribe automatically because email security scanners may follow links.
4. The confirmation button creates or updates the Resend Contact, Segment and Topic subscription.
5. Airtable records the confirmation time and changes the subscriber to `Active`.
6. Resend webhook events mirror unsubscribe, bounce, complaint and suppression states to Airtable.

Confirmation requests are cooled down for 15 minutes. Public responses do not reveal whether an address is already subscribed.

## Contact lifecycle

1. The endpoint validates input and ignores honeypot submissions.
2. Airtable captures the enquiry before any email is attempted.
3. Resend sends an internal notification with `Reply-To` set to the enquirer.
4. Notification failure is recorded in Airtable but does not discard or misreport the captured enquiry.

## Vercel controls

Set every variable listed in `.env.example` for Production. Use separate Airtable bases or credentials for Preview and Development rather than giving preview branches access to production records.

Add Vercel Firewall rate-limit rules for:

- `POST /api/contact`
- `POST /api/newsletter`
- `POST /api/newsletter/confirm`

Start conservatively at five requests per minute per IP for signup and contact submission, then adjust from observed legitimate traffic. Do not log request bodies because they contain personal information.

## Safe rollout and rollback

Before production deployment, verify the flows against a non-production Airtable base and a Resend test domain. After deployment, submit one controlled enquiry and one controlled newsletter subscription, confirm the Airtable records and emails, and then inspect Vercel runtime errors.

Rollback is the previous deployment plus restoration of the previous form environment variables. Airtable and Resend records created during a test should be labelled as test records and removed manually after verification.
