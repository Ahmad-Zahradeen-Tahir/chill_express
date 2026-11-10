# CEO demo script (about 15 minutes)

**Before the meeting**
1. Run `npm run db:reseed` to get a clean data set, then `npm run demo:start`.
2. Open three browser windows (use a private window for each staff login):
   - **Customer:** http://localhost:3000
   - **Cashier:** http://localhost:3000/staff/login → `gombole.cashier@demo.chillexpress.local`
   - **CEO:** http://localhost:3000/staff/login → `ceo@demo.chillexpress.local`
   - Password for all: `ChillDemo#2026`
3. In the cashier window, turn **Sound on** in the live queue.
4. To show the site on a phone, run `cloudflared tunnel --url http://localhost:3000` and open the printed URL.

> Until Paystack test keys are added, payments go through a **clearly-marked simulator** (black "DEMO MODE" banner). Say this upfront. With test keys, the same steps show the real Paystack checkout page.

## 1. Customer orders (website)
1. Homepage: point out the brand, branch picker, the Snap & Tag promo from the menu board, and the contact links (tap-to-call, Instagram).
2. **Order now** → pick **Gombole Road**.
3. Shawarma → choose **Chicken** + **King Size** (₦6,000). Then Loaded Fries **Regular Box** → **With Cheese** (₦3,500). Add a **Soda**.
4. Open the cart, change a quantity, then **Checkout**.
5. Pick **Delivery** and show that the ₦2,000 fee is added. Fill in the details → **Pay with Paystack**.
6. Complete the payment. The customer lands on the tracking page showing **"Payment received — the branch is reviewing your order"**.

## 2. Cashier approves (staff portal)
1. The new order appears in **Awaiting approval** with a chime. Unpaid orders never appear here.
2. Open it: items with their variations, delivery address and landmark, the verified payment and the timeline.
3. **Approve** → **Start preparing** → **Out for delivery** → **Complete**.
4. Meanwhile, the customer's tracking page updates by itself.

## 3. Things going wrong (show the safeguards)
- **Rejection:** place another order and pay. The cashier clicks **Reject** → "Item out of stock". A refund starts automatically and shows *Refund pending* until Paystack confirms it, then *Refunded*.
- **Modification:** sign in as the Gombole branch manager, open a paid order, click **Edit** and add an item. The order is **held** until the customer pays the extra through Paystack. Removing an item starts a partial refund instead.
- **Sold out:** Staff → Availability → mark Soda *Sold out* at Gombole Road. The menu shows it unavailable at Gombole only.
- **Branch security:** the Gombole cashier cannot see Lagos Street orders or any management pages.

## 4. CEO dashboard
1. **Executive dashboard:** gross paid sales, refunds and net revenue (shown separately), average order value, completed and cancelled counts, best sellers, branch comparison and orders by hour.
2. Switch **Today / 7 days / 30 days / custom** and **All / Gombole Road / Lagos Street**.
3. Untick **Include demo data** to show that only real transactions remain. The order just placed is there.
4. **Reports:** download the Sales report as PDF and the Order report as Excel.
5. **Menu:** change a price (and change it back). It goes live immediately and is recorded in the audit log.
6. **Branches:** temporarily close a branch and show that the website stops taking orders for it.
7. **Staff:** create a cashier (a one-time password is shown), set permissions, suspend the account.
8. **Audit log:** every action above is listed.

## Questions to take back from the CEO
- Branch addresses, phone numbers and opening hours.
- Should the ₦2,000 delivery fee vary by area?
- Product photos for the items still showing placeholders.
- Email / WhatsApp provider for customer notifications.
- Hostinger plan (VPS recommended: keeps PostgreSQL).
