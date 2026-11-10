/**
 * Seed: official menu, branches, demo staff/customers and DEMONSTRATION orders.
 * Usage: npm run db:seed            (menu + branches + accounts + demo orders)
 *        npm run db:seed -- --reset (wipe all data first)
 * Every demo record is flagged (isDemo / DEMO_SEED provider / @demo.chillexpress.local emails).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID, createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, pool } from "../index";
import * as s from "../schema";
import { BRANCHES, BUSINESS, MENU } from "./menu-data";
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, type StaffRole } from "../../auth/permissions";

const DEMO_PASSWORD = "ChillDemo#2026";
const K = (naira: number) => naira * 100;

// Deterministic PRNG so demo data is stable between reseeds.
let seed = 20261108;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const CODE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const code = (n: number) => Array.from({ length: n }, () => CODE[Math.floor(rand() * CODE.length)]).join("");

async function reset() {
  await db.execute(sql`
    TRUNCATE TABLE notification_read, notification, notification_delivery, audit_log, rate_limit, dev_sim_record,
      webhook_event, refund, payment, order_modification, order_status_history, delivery_info, order_item, "order",
      branch_product, option, option_group, product, category, staff_branch, user_permission_override, role_permission,
      permission, saved_address, branch_hours, site_setting, session, account, verification, "user", branch
    RESTART IDENTITY CASCADE`);
}

async function createUser(u: { name: string; email: string; role: s.Role; phone?: string; isDemo?: boolean }) {
  const id = randomUUID();
  const hash = await hashPassword(DEMO_PASSWORD);
  await db.insert(s.user).values({ id, name: u.name, email: u.email, role: u.role, phone: u.phone ?? null, emailVerified: true, isDemo: u.isDemo ?? true });
  await db.insert(s.account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash });
  return id;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--reset")) {
    console.log("Resetting all data…");
    await reset();
  }
  const existing = await db.select().from(s.branch);
  if (existing.length) {
    console.log("Database already seeded. Use --reset to reseed.");
    return;
  }

  // ---- Permissions catalogue (role defaults live in code; mirrored here for reporting) ----
  await db.insert(s.permission).values(Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })));
  for (const [role, perms] of Object.entries(ROLE_DEFAULT_PERMISSIONS) as [StaffRole, string[]][]) {
    await db.insert(s.rolePermission).values(perms.map((p) => ({ role, permissionKey: p })));
  }

  // ---- Business settings (contact details supplied by the business) ----
  await db.insert(s.siteSetting).values([
    { key: "business.phone", value: BUSINESS.phone },
    { key: "business.instagram", value: BUSINESS.instagram },
    { key: "business.email", value: null },
  ]);

  // ---- Branches (addresses/hours not yet supplied: left empty and editable) ----
  const branches = await db
    .insert(s.branch)
    .values(BRANCHES.map((b) => ({ ...b, deliveryFeeKobo: K(2000), address: null, phone: null })))
    .returning();

  // ---- Menu ----
  type ProdRow = { id: string; name: string; categoryName: string; base: number; groups: { name: string; options: { id: string; name: string; delta: number }[]; required: boolean }[] };
  const products: ProdRow[] = [];
  let cSort = 0;
  for (const c of MENU) {
    const [cat] = await db.insert(s.category).values({ name: c.name, slug: c.slug, description: c.description, sortOrder: cSort++ }).returning();
    let pSort = 0;
    for (const p of c.products) {
      const [prod] = await db
        .insert(s.product)
        .values({
          categoryId: cat.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          imageUrl: p.image,
          imageIsIllustrative: p.illustrative,
          basePriceKobo: K(p.price),
          featured: !!p.featured,
          sortOrder: pSort++,
        })
        .returning();
      const row: ProdRow = { id: prod.id, name: p.name, categoryName: c.name, base: K(p.price), groups: [] };
      let gSort = 0;
      for (const g of p.groups ?? []) {
        const [grp] = await db
          .insert(s.optionGroup)
          .values({ productId: prod.id, name: g.name, required: g.required, minSelect: g.min, maxSelect: g.max, sortOrder: gSort++ })
          .returning();
        const opts = await db
          .insert(s.option)
          .values(g.options.map((o, i) => ({ groupId: grp.id, name: o.name, priceDeltaKobo: K(o.delta), sortOrder: i })))
          .returning();
        row.groups.push({ name: g.name, required: g.required, options: opts.map((o) => ({ id: o.id, name: o.name, delta: o.priceDeltaKobo })) });
      }
      products.push(row);
      for (const b of branches) await db.insert(s.branchProduct).values({ branchId: b.id, productId: prod.id, available: true });
    }
  }

  // ---- Demo accounts ----
  const [gr, ls] = [branches.find((b) => b.code === "GR")!, branches.find((b) => b.code === "LS")!];
  const ceo = await createUser({ name: "Demo CEO", email: "ceo@demo.chillexpress.local", role: "CEO" });
  await createUser({ name: "Demo Central Manager", email: "manager@demo.chillexpress.local", role: "CENTRAL_MANAGER" });
  const staff: { email: string; name: string; role: StaffRole; branch: typeof gr }[] = [
    { email: "gombole.manager@demo.chillexpress.local", name: "Demo Manager (Gombole Road)", role: "BRANCH_MANAGER", branch: gr },
    { email: "lagos.manager@demo.chillexpress.local", name: "Demo Manager (Lagos Street)", role: "BRANCH_MANAGER", branch: ls },
    { email: "gombole.cashier@demo.chillexpress.local", name: "Demo Cashier (Gombole Road)", role: "CASHIER", branch: gr },
    { email: "lagos.cashier@demo.chillexpress.local", name: "Demo Cashier (Lagos Street)", role: "CASHIER", branch: ls },
  ];
  const staffIds: Record<string, string[]> = { [gr.id]: [], [ls.id]: [] };
  for (const st of staff) {
    const id = await createUser({ name: st.name, email: st.email, role: st.role });
    await db.insert(s.staffBranch).values({ userId: id, branchId: st.branch.id });
    staffIds[st.branch.id].push(id);
  }
  const customerNames = ["Aisha (Demo)", "Musa (Demo)", "Fatima (Demo)", "Ibrahim (Demo)", "Zainab (Demo)"];
  const customers: { id: string; name: string; email: string; phone: string }[] = [];
  for (let i = 0; i < customerNames.length; i++) {
    const email = `customer${i + 1}@demo.chillexpress.local`;
    const phone = `+234 800 000 00${10 + i}`;
    const id = await createUser({ name: customerNames[i], email, role: "CUSTOMER", phone });
    customers.push({ id, name: customerNames[i], email, phone });
    await db.insert(s.savedAddress).values({ userId: id, label: "Home", address: "Demo address (sample)", landmark: "Sample landmark" });
  }

  // ---- DEMONSTRATION orders (last 60 days) ----
  const days = 60;
  const now = new Date();
  const guestNames = ["Guest (Demo)", "Walk-in Online (Demo)", "Demo Buyer"];
  type Line = { productId: string; productName: string; categoryName: string; unitPriceKobo: number; options: s.OrderItemOptionSnapshot[]; quantity: number; lineTotalKobo: number };
  const makeLine = (): Line => {
    // Weighted choice: shawarma & fries sell most.
    const weights = products.map((p) => (p.categoryName === "Shawarma" ? 6 : p.categoryName === "Loaded Fries" ? 3 : p.categoryName === "Burgers" ? 2 : 2));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let p = products[0];
    for (let i = 0; i < products.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        p = products[i];
        break;
      }
    }
    const options: s.OrderItemOptionSnapshot[] = [];
    for (const g of p.groups) {
      if (g.required || rand() < 0.45) {
        const o = pick(g.options);
        options.push({ optionId: o.id, groupName: g.name, optionName: o.name, priceDeltaKobo: o.delta });
      }
    }
    const unit = p.base + options.reduce((a, o) => a + o.priceDeltaKobo, 0);
    const qty = rand() < 0.75 ? 1 : between(2, 3);
    return { productId: p.id, productName: p.name, categoryName: p.categoryName, unitPriceKobo: unit, options, quantity: qty, lineTotalKobo: unit * qty };
  };

  let orderCount = 0;
  for (let d = days; d >= 0; d--) {
    for (const b of branches) {
      const weekend = [5, 6, 0].includes(new Date(now.getTime() - d * 86400000).getUTCDay());
      const n = d === 0 ? between(6, 9) : between(weekend ? 9 : 5, weekend ? 16 : 11) + (b.code === "GR" ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const created = new Date(now.getTime() - d * 86400000);
        created.setUTCHours(between(9, 20), between(0, 59), between(0, 59), 0); // 10:00–21:59 Lagos
        if (created > now) created.setTime(now.getTime() - between(5, 240) * 60000);
        const type = rand() < 0.45 ? "DELIVERY" : "PICKUP";
        const lines = Array.from({ length: between(1, 3) }, makeLine);
        const subtotal = lines.reduce((a, l) => a + l.lineTotalKobo, 0);
        const fee = type === "DELIVERY" ? b.deliveryFeeKobo : 0;
        const total = subtotal + fee;
        const cust = rand() < 0.4 ? pick(customers) : null;

        // Status mix: history mostly completed; today has a live queue.
        let status: s.OrderStatus;
        const r = rand();
        if (d === 0 && i < 6) {
          status = (["PENDING_APPROVAL", "PENDING_APPROVAL", "CONFIRMED", "PREPARING", type === "DELIVERY" ? "OUT_FOR_DELIVERY" : "READY_FOR_PICKUP", "COMPLETED"] as const)[i];
        } else if (r < 0.04) status = "REJECTED";
        else if (r < 0.06) status = "CANCELLED";
        else if (r < 0.1) status = rand() < 0.5 ? "EXPIRED" : "PAYMENT_FAILED";
        else status = "COMPLETED";
        const paid = !["EXPIRED", "PAYMENT_FAILED"].includes(status);
        const refunded = status === "REJECTED" || status === "CANCELLED";

        const ref = `CE-${b.code}-${code(6)}`;
        const [o] = await db
          .insert(s.order)
          .values({
            reference: ref,
            branchId: b.id,
            customerUserId: cust?.id ?? null,
            customerName: cust?.name ?? pick(guestNames),
            customerPhone: cust?.phone ?? `+234 800 000 0${between(100, 999)}`,
            customerEmail: cust?.email ?? `guest${between(1, 99)}@demo.chillexpress.local`,
            type,
            pickupTime: type === "PICKUP" ? "ASAP" : null,
            subtotalKobo: subtotal,
            deliveryFeeKobo: fee,
            totalKobo: total,
            paidKobo: paid ? total : 0,
            refundedKobo: refunded ? total : 0,
            status,
            paymentStatus: !paid ? "UNPAID" : refunded ? "REFUNDED" : "PAID",
            trackingTokenHash: createHash("sha256").update(randomBytes(16)).digest("hex"),
            rejectionReason: status === "REJECTED" ? "Item unavailable (demo)" : status === "CANCELLED" ? "Customer requested cancellation (demo)" : null,
            isDemo: true,
            paidAt: paid ? new Date(created.getTime() + 60000) : null,
            approvedAt: paid && status !== "PENDING_APPROVAL" && status !== "REJECTED" ? new Date(created.getTime() + 4 * 60000) : null,
            completedAt: status === "COMPLETED" ? new Date(created.getTime() + between(18, 45) * 60000) : null,
            createdAt: created,
            updatedAt: created,
          })
          .returning();
        await db.insert(s.orderItem).values(lines.map((l) => ({ ...l, orderId: o.id })));
        if (type === "DELIVERY") {
          await db.insert(s.deliveryInfo).values({ orderId: o.id, address: "Demo delivery address, Maiduguri (sample)", landmark: "Sample landmark", instructions: rand() < 0.3 ? "Call on arrival (demo)" : null });
        }
        const actor = pick(staffIds[b.id]);
        const hist: { toStatus: s.OrderStatus; fromStatus: s.OrderStatus | null; at: number; actor: string | null }[] = [{ fromStatus: null, toStatus: "AWAITING_PAYMENT", at: 0, actor: null }];
        if (paid) {
          hist.push({ fromStatus: "AWAITING_PAYMENT", toStatus: "PENDING_APPROVAL", at: 1, actor: null });
          const flow: s.OrderStatus[] =
            status === "REJECTED"
              ? ["REJECTED"]
              : status === "CANCELLED"
                ? ["CONFIRMED", "CANCELLED"]
                : status === "PENDING_APPROVAL"
                  ? []
                  : (["CONFIRMED", "PREPARING", type === "DELIVERY" ? "OUT_FOR_DELIVERY" : "READY_FOR_PICKUP", "COMPLETED"] as s.OrderStatus[]).slice(
                      0,
                      ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED"].indexOf(status) === 4
                        ? 4
                        : status === "OUT_FOR_DELIVERY" || status === "READY_FOR_PICKUP"
                          ? 3
                          : status === "PREPARING"
                            ? 2
                            : 1,
                    );
          let prev: s.OrderStatus = "PENDING_APPROVAL";
          flow.forEach((st, idx) => {
            hist.push({ fromStatus: prev, toStatus: st, at: 4 + idx * 8, actor });
            prev = st;
          });
        } else {
          hist.push({ fromStatus: "AWAITING_PAYMENT", toStatus: status, at: status === "EXPIRED" ? 60 : 2, actor: null });
        }
        await db.insert(s.orderStatusHistory).values(
          hist.map((h) => ({
            orderId: o.id,
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            actorUserId: h.actor,
            note: "Demo data",
            createdAt: new Date(created.getTime() + h.at * 60000),
          })),
        );
        const [pay] = await db
          .insert(s.payment)
          .values({
            orderId: o.id,
            purpose: "ORDER",
            provider: "DEMO_SEED",
            reference: `DEMO_${code(10)}`,
            amountKobo: total,
            status: paid ? "SUCCESS" : status === "EXPIRED" ? "ABANDONED" : "FAILED",
            channel: paid ? "demo" : null,
            failureReason: paid ? null : "Demo: not paid",
            verifiedAt: paid ? new Date(created.getTime() + 60000) : null,
            createdAt: created,
            updatedAt: created,
          })
          .returning();
        if (refunded) {
          const refundedAt = new Date(created.getTime() + 3 * 3600000);
          await db.insert(s.refund).values({
            orderId: o.id,
            paymentId: pay.id,
            amountKobo: total,
            reason: `${o.rejectionReason}`,
            status: refundedAt > now ? "PROCESSING" : "REFUNDED",
            providerRefundId: `DEMO_RF_${code(8)}`,
            initiatedByUserId: actor,
            submittedAt: new Date(created.getTime() + 10 * 60000),
            refundedAt: refundedAt > now ? null : refundedAt,
            createdAt: new Date(created.getTime() + 10 * 60000),
          });
          if (refundedAt > now) await db.update(s.order).set({ refundedKobo: 0, paymentStatus: "PAID" }).where(sql`id = ${o.id}`);
        }
        if (status === "PENDING_APPROVAL") {
          await db.insert(s.notification).values({
            type: "order.new_paid",
            title: `New paid order · ${ref}`,
            body: `${type === "DELIVERY" ? "Delivery" : "Pickup"} · demo order`,
            orderId: o.id,
            branchId: b.id,
            link: `/staff/orders/${o.id}`,
            permissionKey: "orders.view",
            createdAt: created,
          });
        }
        orderCount++;
      }
    }
  }
  await db.insert(s.auditLog).values({ actorUserId: ceo, actorLabel: "seed", action: "seed.completed", entity: "system", data: { orders: orderCount } });
  console.log(`Seeded ${branches.length} branches, ${products.length} products, ${orderCount} DEMO orders.`);
  console.log(`Demo password for every demo account: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
