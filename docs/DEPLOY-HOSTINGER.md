# Deploying to Hostinger

The app is a plain Node.js server (`output: "standalone"`) with no Vercel-specific code. Uploads are stored on local disk, and cron calls a secured HTTP route.

## Option A — Hostinger VPS (recommended, no code changes)

1. Use an Ubuntu 24.04 VPS (KVM 2 or higher). Point an A record (e.g. `order.chillexpress.ng`) at it.
2. Install Node 24, PostgreSQL 16, Nginx, certbot and PM2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs postgresql nginx certbot python3-certbot-nginx
   sudo npm i -g pm2
   sudo -u postgres createuser chill --pwprompt && sudo -u postgres createdb -O chill chill_express
   ```
3. Copy the project to `/var/www/chill_express`. Create `.env.production` from `.env.example` with:
   - `PAYMENTS_DRIVER=paystack` and the **live** Paystack keys (after testing with test keys)
   - `ALLOW_SIMULATED_PAYMENTS=false`
   - `APP_URL` and `BETTER_AUTH_URL` set to `https://your-domain`
   - newly generated secrets (`openssl rand -hex 32`)
4. Build and migrate:
   ```bash
   npm ci && npx drizzle-kit migrate && npm run build
   npm run db:seed    # menu + branches only matter on first run; delete demo accounts afterwards
   ```
5. Start with PM2:
   ```bash
   ENV_FILE=.env.production pm2 start scripts/start-prod.sh --name chill-express
   pm2 save && pm2 startup
   ```
6. Configure Nginx (proxy to `127.0.0.1:3000`, `client_max_body_size 6m;`), then run `sudo certbot --nginx -d your-domain`.
7. Add the cron job (reconciles payments and expires unpaid orders every 5 minutes):
   ```
   */5 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/reconcile > /dev/null
   ```
8. In the Paystack dashboard, set the webhook URL to `https://your-domain/api/paystack/webhook` and the callback URL to `https://your-domain/api/payments/callback`.
9. Back up nightly with `pg_dump` and include `uploads/` in the backups.

## Option B — Hostinger Web/Cloud hosting (Node.js app + MySQL)

Shared and Cloud plans only provide MySQL/MariaDB. This would need:
- Converting the Drizzle schema in `src/server/db/schema/*` from `pg-core` to `mysql-core`. Enums, `jsonb`, `uuid` defaults and some raw SQL in `analytics.ts`, `rate-limit.ts` and `payments.ts` must be ported.
- Switching Better Auth's adapter `provider` to `"mysql"`.
- Regenerating migrations.

That is roughly 1–2 days of work plus re-running the test suites. Option A avoids it.

## Go-live checklist
- [ ] Paystack live keys set; one real low-value order placed and paid end to end.
- [ ] All demo accounts deleted (or `db:reseed` replaced with a production seed), and real staff created by the CEO.
- [ ] Branch addresses, hours and the "Only accept orders during opening hours" toggle set.
- [ ] Remaining placeholder photos replaced.
- [ ] Email/WhatsApp provider chosen (until then, customers rely on the tracking page).
- [ ] Backups and uptime monitoring in place.
