# Chill. Express — Ordering & Management Platform

Online ordering (pickup and delivery, Paystack only), a staff operations portal and a CEO dashboard for **Chill. Express**, Maiduguri (Gombole Road and Lagos Street). All three interfaces share one Next.js app and one PostgreSQL database.

| Interface | URL | Who |
|---|---|---|
| Customer website | `/` | Public, guest checkout or customer account |
| Staff portal | `/staff` | Cashiers, branch managers, central managers |
| CEO dashboard | `/admin` | CEO (and anyone granted `analytics.view` etc.) |

## Quick start (local demo)

Requirements: Node 24, PostgreSQL 14+.

```bash
npm install
cp .env.example .env.local        # then edit DATABASE_URL and secrets
createdb chill_express
npm run demo:setup                # migrate + seed (menu, branches, demo accounts, demo orders)
npm run demo:start                # production build, served on http://localhost:3000
```

To run in development instead: `npm run dev`.

### Demo accounts

All demo accounts use the password **`ChillDemo#2026`**. They are clearly marked as demo data.

| Role | Email |
|---|---|
| CEO | `ceo@demo.chillexpress.local` |
| Central manager | `manager@demo.chillexpress.local` |
| Branch manager, Gombole Road | `gombole.manager@demo.chillexpress.local` |
| Branch manager, Lagos Street | `lagos.manager@demo.chillexpress.local` |
| Cashier, Gombole Road | `gombole.cashier@demo.chillexpress.local` |
| Cashier, Lagos Street | `lagos.cashier@demo.chillexpress.local` |
| Customers | `customer1@demo.chillexpress.local` … `customer5@…` |

Staff sign in at `/staff/login`. Before going live, delete or replace every demo account; `npm run db:reseed` wipes **all** data and reseeds.

## Payments

Paystack is the only payment method. The flow is:

1. The server creates the order as `AWAITING_PAYMENT`.
2. The server initializes a Paystack transaction (amount in kobo, NGN, unique reference).
3. The customer pays on Paystack and is redirected to `/api/payments/callback`, where the server **verifies** the transaction.
4. Paystack also calls the webhook at `/api/paystack/webhook`.
5. The order moves to `PENDING_APPROVAL` only after the payment is verified.

Safeguards:
- **One verification path.** The callback, the webhook and reconciliation all go through `confirmPayment()`.
- **Amount checks.** The verified amount and currency must match what the server requested.
- **Idempotent.** A conditional `UPDATE … WHERE status <> 'SUCCESS'` means a payment is only ever processed once.
- **Signed webhooks.** Signatures are HMAC-SHA512 and compared in constant time; duplicate deliveries are stored once and ignored.
- **No reject, cancel or refunds.** Paid orders can only be approved and moved through the kitchen workflow to completion. A modification that lowers the total just changes the order; money is settled with the customer outside the system. Duplicate or late payments raise a staff alert for manual handling.
- **Price increases.** A modification that raises the total puts the order on hold (`AWAITING_ADDITIONAL_PAYMENT`) until the extra Paystack payment is verified.

### Payment modes (`PAYMENTS_DRIVER`)

- `paystack`: real Paystack (use `sk_test_…` keys for the demo). Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`.
- `dev-sim`: **a clearly-labelled simulator** used until Paystack keys are available. It goes through the same verification and webhook code. Every page shows a "DEMO MODE — payments are SIMULATED" banner. It refuses to run in a production build unless `ALLOW_SIMULATED_PAYMENTS=true`, which must never be set on the live server.

### Switching the demo to Paystack test mode

1. Create a free Paystack account and copy the **test** keys from Settings → API Keys & Webhooks.
2. In `.env.local`, set `PAYMENTS_DRIVER=paystack`, add both keys, and set `ALLOW_SIMULATED_PAYMENTS=false`.
3. For webhooks while running locally, expose the app with `cloudflared tunnel --url http://localhost:3000`. Set the tunnel URL as `APP_URL`, and set `<tunnel>/api/paystack/webhook` as the Paystack test webhook URL.
4. Restart with `npm run demo:start`. Paystack test cards: <https://paystack.com/docs/payments/test-payments>.

Even without webhooks, payments are verified on the redirect. Run `npm run reconcile` (or click "Re-check with Paystack" on an order) to pick up anything missed.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / run the standalone server |
| `npm run demo:setup` | Migrate + seed |
| `npm run demo:start` | Build + start production server |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run db:seed` / `db:reseed` | Seed / wipe everything and reseed |
| `npm run reconcile` | Re-verify pending payments, expire unpaid orders (run from cron in production) |
| `npm test` | Unit tests (pricing, state machine, permissions, webhook signatures) |
| `npm run test:e2e` | Playwright end-to-end tests (needs the app running on :3000 with the seed loaded) |
| `npm run typecheck` / `npm run lint` | Static checks |

## Architecture

- **Stack:** Next.js 16 (App Router, server actions), TypeScript, Tailwind v4, PostgreSQL + Drizzle ORM, Better Auth (email/password, DB sessions), Zod, Recharts, ExcelJS, React-PDF.
- **Money:** stored and computed as integer **kobo**. Clients send only product ids, option ids and quantities. Every price is computed on the server (`src/server/services/pricing-core.ts`), and order lines snapshot the price paid.
- **Authorization:** every server action and route calls `requirePermission(permission, { branchId })` in `src/server/auth/guard.ts`. It combines role defaults with per-person overrides, and staff are limited to their assigned branches (central manager and CEO see all branches). Hiding navigation items is cosmetic only.
- **Order state machine:** `src/server/services/order-state.ts` is the only place legal transitions are defined. Updates use optimistic checks so two staff cannot approve the same order twice.
- **Audit:** approvals, status changes, modifications, price and menu changes, staff changes and exports are all written to `audit_log`.
- **Notifications:** in-app notifications for staff are scoped by permission and branch. Email and WhatsApp channels exist as interfaces, but **no provider is configured**: outbound messages are recorded as `NOT_CONFIGURED`, and nothing claims to have been sent.
- **Hosting:** host-neutral, running as a plain Node server (`output: "standalone"`). Uploads go to local disk (`UPLOAD_DIR`) and cron calls a secured route. See `docs/DEPLOY-HOSTINGER.md`.

```
src/app/(customer)     public site: home, menu, checkout, order tracking, account
src/app/staff          staff portal: live queue, orders, notifications
src/app/admin          CEO dashboard: analytics, reports, menu, branches, staff, audit
src/app/api            auth, Paystack callback + webhook, reports, uploads, cron
src/server/db          Drizzle schema, migrations config, seed (official menu)
src/server/services    pricing, orders, payments, analytics, reports …
src/server/paystack    Paystack client, simulator, signature verification
tests/unit, tests/e2e  Vitest and Playwright suites
```

## Data that still needs confirming by the business

These are left blank or editable rather than invented:
- Branch addresses and phone numbers, opening hours, and a business email (Admin → Branches).
- Real product photos: Shawarma, Double Decker, Super Loaded Fries, Premium Flavors, Soda and Ice Cream use labelled placeholders.
- Product descriptions (Admin → Menu).
- A vector or transparent logo file (the current one is extracted from the supplied JPG).
