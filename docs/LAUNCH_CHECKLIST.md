# JobPilot AI Launch Checklist

## Legal and Compliance

- Review `/privacy` and `/terms` with qualified counsel before public paid launch.
- Confirm `SUPPORT_EMAIL`, `SMTP_FROM`, and `SMTP_REPLY_TO` route to a monitored mailbox.
- Verify the cookie banner appears for a fresh browser profile and that "Necessary only" suppresses `/api/analytics/*` calls.

## Authentication and Security

- Set `ENCRYPTION_SECRET` to a 64-character hex value in production.
- Set `REQUIRE_EMAIL_VERIFICATION=true` and configure SMTP before enabling public password signup.
- Keep `ENABLE_PASSWORD_RESET_TOKEN_RESPONSE=false` and `ENABLE_EMAIL_VERIFICATION_TOKEN_RESPONSE=false` in production.
- Enable `LOGIN_CAPTCHA_ENABLED=true` and `LOGIN_2FA_ENABLED=true` for owner/password login surfaces.
- Confirm local database files under `backend/data/` are not committed.

## Stripe Payment Lifecycle

Configure live/test variables:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_ANNUAL_PRICE_ID=
```

Run webhook forwarding in test mode:

```bash
stripe listen --forward-to http://localhost:4000/api/billing/webhook
```

Test these flows before launch:

- Checkout success: use Stripe test card `4242 4242 4242 4242`; verify `/settings?billing=success`, webhook activation, and `tier: pro`.
- Checkout failure: use Stripe test card `4000 0000 0000 9995`; verify no Pro access.
- Customer portal cancel: open "Manage subscription", cancel at period end, verify `cancelAtPeriodEnd: true`.
- Immediate cancellation/deletion event: trigger `customer.subscription.deleted`; verify user falls back to Basic.
- Failed renewal: trigger or simulate `invoice.payment_failed`; verify `billing.status: past_due` and Basic access.
- Upgrade/downgrade: configure Stripe Customer Portal products/prices, switch monthly/annual there, and verify `customer.subscription.updated` changes `priceId`.

Useful Stripe CLI events:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
stripe trigger invoice.paid
```

## SEO and Search Submission

- Confirm production domain replaces `https://jobpilot.ai` in:
  - `frontend/index.html`
  - `frontend/public/robots.txt`
  - `frontend/public/sitemap.xml`
- Submit `https://jobpilot.ai/sitemap.xml` in Google Search Console.
- Submit the same sitemap in Bing Webmaster Tools.
- Optional: submit through Yandex Webmaster if targeting those regions.
- Verify `/robots.txt`, `/sitemap.xml`, `/privacy`, `/terms`, and `/support` are publicly reachable after deployment.

## Feedback and Analytics

- Send one `/support` support request and one bug report; verify they appear in `supportTickets` and/or the support mailbox.
- Accept analytics consent and visit several pages; verify `analyticsEvents` records page views.
- Choose necessary-only consent in a clean browser and confirm no analytics requests are sent.
