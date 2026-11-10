import "server-only";
import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { order, orderModification, orderStatusHistory, payment } from "@/server/db/schema";
import type { OrderStatus } from "@/server/db/schema/enums";
import { paymentReference } from "@/lib/ids";
import { formatNaira } from "@/lib/money";
import { getPaymentProvider, PaymentProviderError } from "@/server/paystack/provider";
import { audit } from "./audit";
import { messageCustomer, notifyStaff } from "./notifications";
import { applyModificationAfter, type ModificationAfter } from "./modification-apply";

export const ORDER_PAYMENT_WINDOW_MIN = 60;

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

/** Create a payment row and initialize it with the provider. Returns the URL to send the customer to. */
export async function startPayment(input: {
  orderId: string;
  purpose: "ORDER" | "ADDITIONAL";
  amountKobo: number;
  modificationId?: string;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const o = await db.query.order.findFirst({ where: eq(order.id, input.orderId) });
  if (!o) throw new Error("Order not found");
  if (!o.customerEmail) throw new Error("A customer email is required for Paystack payments");
  const provider = getPaymentProvider();
  const reference = paymentReference(input.purpose === "ORDER" ? "CEP" : "CEX");
  const [p] = await db
    .insert(payment)
    .values({
      orderId: o.id,
      purpose: input.purpose,
      modificationId: input.modificationId ?? null,
      provider: provider.name,
      reference,
      amountKobo: input.amountKobo,
      currency: "NGN",
      status: "INITIALIZED",
    })
    .returning();
  try {
    const { authorizationUrl } = await provider.initialize({
      reference,
      amountKobo: input.amountKobo,
      email: o.customerEmail,
      callbackUrl: `${appUrl()}/api/payments/callback`,
      metadata: { orderReference: o.reference, orderId: o.id, purpose: input.purpose },
    });
    await db.update(payment).set({ authorizationUrl, updatedAt: new Date() }).where(eq(payment.id, p.id));
    return { authorizationUrl, reference };
  } catch (e) {
    await db
      .update(payment)
      .set({ status: "FAILED", failureReason: e instanceof Error ? e.message : "init failed", updatedAt: new Date() })
      .where(eq(payment.id, p.id));
    throw e instanceof PaymentProviderError ? e : new PaymentProviderError("Could not start payment. Please try again.");
  }
}

async function setOrderStatus(
  tx: Tx,
  o: { id: string; status: OrderStatus },
  to: OrderStatus,
  extra: Partial<typeof order.$inferInsert> = {},
  note?: string,
  actorUserId?: string | null,
) {
  const res = await tx
    .update(order)
    .set({ ...extra, status: to, updatedAt: new Date() })
    .where(and(eq(order.id, o.id), eq(order.status, o.status)))
    .returning({ id: order.id });
  if (!res.length) return false;
  await tx.insert(orderStatusHistory).values({ orderId: o.id, fromStatus: o.status, toStatus: to, note, actorUserId: actorUserId ?? null });
  return true;
}

export type ConfirmOutcome =
  | { kind: "paid"; orderId: string; orderReference: string }
  | { kind: "already"; orderId: string; orderReference: string }
  | { kind: "failed"; orderId: string; orderReference: string; reason: string }
  | { kind: "pending"; orderId: string; orderReference: string }
  | { kind: "not_found" };

/**
 * The single place where a payment becomes SUCCESS. Used by the redirect callback, the webhook and reconciliation.
 * Always re-verifies with the provider; never trusts the browser or the webhook body for money.
 */
export async function confirmPayment(reference: string, source: string): Promise<ConfirmOutcome> {
  const p = await db.query.payment.findFirst({ where: eq(payment.reference, reference) });
  if (!p) return { kind: "not_found" };
  const o0 = await db.query.order.findFirst({ where: eq(order.id, p.orderId) });
  if (!o0) return { kind: "not_found" };
  if (p.status === "SUCCESS") return { kind: "already", orderId: o0.id, orderReference: o0.reference };

  const v = await getPaymentProvider().verify(reference);

  if (v.status === "pending") return { kind: "pending", orderId: o0.id, orderReference: o0.reference };
  // Paystack reports never-attempted transactions as "abandoned". During background reconciliation the
  // customer may still be on the checkout page, so do not fail it until the payment window has passed.
  const ageMin = (Date.now() - p.createdAt.getTime()) / 60_000;
  if (v.status === "abandoned" && source === "reconcile" && ageMin < ORDER_PAYMENT_WINDOW_MIN) {
    return { kind: "pending", orderId: o0.id, orderReference: o0.reference };
  }

  if (v.status !== "success") {
    await db.transaction(async (tx) => {
      const upd = await tx
        .update(payment)
        .set({
          status: v.status === "abandoned" ? "ABANDONED" : "FAILED",
          failureReason: v.gatewayResponse,
          raw: v.raw as never,
          updatedAt: new Date(),
        })
        .where(and(eq(payment.id, p.id), eq(payment.status, "INITIALIZED")))
        .returning({ id: payment.id });
      if (upd.length && p.purpose === "ORDER") {
        const o = await tx.query.order.findFirst({ where: eq(order.id, p.orderId) });
        if (o?.status === "AWAITING_PAYMENT") await setOrderStatus(tx, o, "PAYMENT_FAILED", {}, v.gatewayResponse ?? "Payment not completed");
        await audit(tx, { actorLabel: source, action: "payment.failed", entity: "payment", entityId: p.id, branchId: o?.branchId, data: { reference, status: v.status } });
      }
    });
    return { kind: "failed", orderId: o0.id, orderReference: o0.reference, reason: v.gatewayResponse || "Payment was not completed" };
  }

  // Successful at provider: validate amount and currency against what we asked for.
  if (v.amountKobo !== p.amountKobo || v.currency !== "NGN") {
    await db.transaction(async (tx) => {
      await tx
        .update(payment)
        .set({ failureReason: `Amount/currency mismatch: got ${v.amountKobo} ${v.currency}`, raw: v.raw as never, updatedAt: new Date() })
        .where(eq(payment.id, p.id));
      await audit(tx, { actorLabel: source, action: "payment.mismatch", entity: "payment", entityId: p.id, branchId: o0.branchId, data: { expected: p.amountKobo, got: v.amountKobo, currency: v.currency } });
      await notifyStaff(tx, {
        type: "payment.mismatch",
        title: `Payment needs review · ${o0.reference}`,
        body: `Paystack reported ${v.amountKobo / 100} ${v.currency}, expected ${formatNaira(p.amountKobo)}. Order not released.`,
        orderId: o0.id,
        branchId: o0.branchId,
        link: `/staff/orders/${o0.id}`,
        permissionKey: "orders.modify",
      });
    });
    return { kind: "failed", orderId: o0.id, orderReference: o0.reference, reason: "Payment amount did not match. Our team has been alerted." };
  }

  return db.transaction(async (tx): Promise<ConfirmOutcome> => {
    // Idempotency: only the first verifier flips the row to SUCCESS.
    const flipped = await tx
      .update(payment)
      .set({
        status: "SUCCESS",
        verifiedAt: new Date(),
        providerTransactionId: v.transactionId,
        channel: v.channel,
        raw: v.raw as never,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(payment.id, p.id), ne(payment.status, "SUCCESS")))
      .returning({ id: payment.id });
    if (!flipped.length) return { kind: "already", orderId: o0.id, orderReference: o0.reference };

    // Lock the order row for the rest of this transaction.
    await tx.execute(sql`SELECT id FROM "order" WHERE id = ${o0.id} FOR UPDATE`);
    const o = (await tx.query.order.findFirst({ where: eq(order.id, o0.id) }))!;
    const paid = o.paidKobo + p.amountKobo;
    await audit(tx, { actorLabel: source, action: "payment.success", entity: "payment", entityId: p.id, branchId: o.branchId, data: { reference, amountKobo: p.amountKobo } });

    if (p.purpose === "ORDER") {
      const releasable: OrderStatus[] = ["AWAITING_PAYMENT", "PAYMENT_FAILED", "EXPIRED"];
      if (releasable.includes(o.status)) {
        await setOrderStatus(tx, o, "PENDING_APPROVAL", { paidKobo: paid, paymentStatus: "PAID", paidAt: new Date() }, "Payment verified");
        await notifyStaff(tx, {
          type: "order.new_paid",
          title: `New paid order · ${o.reference}`,
          body: `${o.type === "DELIVERY" ? "Delivery" : "Pickup"} · ${formatNaira(o.totalKobo)} · ${o.customerName}`,
          orderId: o.id,
          branchId: o.branchId,
          link: `/staff/orders/${o.id}`,
          permissionKey: "orders.view",
        });
        await messageCustomer(tx, o, "order_paid", { reference: o.reference, totalKobo: o.totalKobo });
      } else {
        // Duplicate payment for an order that is already paid: record it and alert managers to handle it manually.
        await tx.update(order).set({ paidKobo: paid, updatedAt: new Date() }).where(eq(order.id, o.id));
        await audit(tx, { actorLabel: source, action: "payment.duplicate", entity: "order", entityId: o.id, branchId: o.branchId, data: { reference } });
        await notifyStaff(tx, {
          type: "payment.duplicate",
          title: `Duplicate payment · ${o.reference}`,
          body: `${formatNaira(p.amountKobo)} was paid again for an order that was already paid. Handle with the customer directly.`,
          orderId: o.id,
          branchId: o.branchId,
          link: `/staff/orders/${o.id}`,
          permissionKey: "orders.modify",
        });
      }
      return { kind: "paid", orderId: o.id, orderReference: o.reference };
    }

    // ADDITIONAL payment for an order modification.
    await tx.update(order).set({ paidKobo: paid, updatedAt: new Date() }).where(eq(order.id, o.id));
    const mod = p.modificationId
      ? await tx.query.orderModification.findFirst({ where: eq(orderModification.id, p.modificationId) })
      : null;
    if (mod && mod.status === "AWAITING_PAYMENT" && o.status === "AWAITING_ADDITIONAL_PAYMENT") {
      await applyModificationAfter(tx, o.id, mod.after as ModificationAfter);
      await tx.update(orderModification).set({ status: "APPLIED", resolvedAt: new Date() }).where(eq(orderModification.id, mod.id));
      const restore = (o.statusBeforeHold ?? "PENDING_APPROVAL") as OrderStatus;
      const fresh = (await tx.query.order.findFirst({ where: eq(order.id, o.id) }))!;
      await setOrderStatus(tx, fresh, restore, { statusBeforeHold: null }, "Additional payment verified; modification applied");
      await notifyStaff(tx, {
        type: "order.additional_paid",
        title: `Extra payment received · ${o.reference}`,
        body: `${formatNaira(p.amountKobo)} paid. Order modification applied.`,
        orderId: o.id,
        branchId: o.branchId,
        link: `/staff/orders/${o.id}`,
        permissionKey: "orders.view",
      });
    } else {
      // Modification was withdrawn (or the order closed) before the customer paid: alert managers to handle it manually.
      await audit(tx, { actorLabel: source, action: "payment.unmatched_additional", entity: "order", entityId: o.id, branchId: o.branchId, data: { reference } });
      await notifyStaff(tx, {
        type: "payment.unmatched_additional",
        title: `Extra payment needs attention · ${o.reference}`,
        body: `${formatNaira(p.amountKobo)} arrived after the modification was withdrawn. Handle with the customer directly.`,
        orderId: o.id,
        branchId: o.branchId,
        link: `/staff/orders/${o.id}`,
        permissionKey: "orders.modify",
      });
    }
    return { kind: "paid", orderId: o.id, orderReference: o.reference };
  });
}

/** Re-verify stale INITIALIZED payments and expire unpaid orders. */
export async function reconcilePayments() {
  const stale = await db
    .select({ reference: payment.reference })
    .from(payment)
    .where(and(eq(payment.status, "INITIALIZED"), lt(payment.createdAt, sql`now() - interval '3 minutes'`), ne(payment.provider, "DEMO_SEED")))
    .orderBy(desc(payment.createdAt))
    .limit(100);
  let confirmed = 0;
  for (const s of stale) {
    try {
      const r = await confirmPayment(s.reference, "reconcile");
      if (r.kind === "paid") confirmed++;
    } catch {
      /* provider unreachable; retry later */
    }
  }
  // Expire unpaid orders after the payment window.
  const expired = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: order.id, status: order.status })
      .from(order)
      .where(
        and(
          inArray(order.status, ["AWAITING_PAYMENT", "PAYMENT_FAILED"]),
          lt(order.createdAt, sql`now() - make_interval(mins => ${ORDER_PAYMENT_WINDOW_MIN})`),
        ),
      );
    let n = 0;
    for (const r of rows) if (await setOrderStatus(tx, r, "EXPIRED", {}, "Unpaid after payment window")) n++;
    return n;
  });
  return { checked: stale.length, confirmed, expired };
}
