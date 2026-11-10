import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/server/db";
import { order, payment, refund } from "@/server/db/schema";
import { formatNaira } from "@/lib/money";
import { getPaymentProvider, type RefundResult } from "@/server/paystack/provider";
import { audit } from "./audit";
import { messageCustomer, notifyStaff } from "./notifications";

/** Amount already refunded or currently in a non-failed refund for an order. */
export async function committedRefundKobo(tx: DbOrTx, orderId: string): Promise<number> {
  const [r] = await tx
    .select({ s: sql<number>`coalesce(sum(${refund.amountKobo}),0)::int` })
    .from(refund)
    .where(and(eq(refund.orderId, orderId), ne(refund.status, "FAILED")));
  return r?.s ?? 0;
}

/**
 * Creates PENDING refund rows (not yet sent to the provider) that cover `amountKobo`,
 * allocated across the order's successful payments. Call submitRefunds() after the transaction commits.
 */
export async function createRefunds(
  tx: DbOrTx,
  input: { orderId: string; amountKobo: number; reason: string; actorUserId?: string | null },
): Promise<string[]> {
  if (input.amountKobo <= 0) return [];
  const pays = await tx
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, input.orderId), eq(payment.status, "SUCCESS")));
  // Demo-seed payments are not real transactions and cannot be refunded through a provider.
  const realPays = pays.filter((p) => p.provider !== "DEMO_SEED");
  const existing = await tx
    .select({ paymentId: refund.paymentId, amount: refund.amountKobo })
    .from(refund)
    .where(and(eq(refund.orderId, input.orderId), ne(refund.status, "FAILED")));

  let remaining = input.amountKobo;
  const ids: string[] = [];
  for (const p of realPays.sort((a, b) => b.amountKobo - a.amountKobo)) {
    if (remaining <= 0) break;
    const already = existing.filter((e) => e.paymentId === p.id).reduce((s, e) => s + e.amount, 0);
    const available = p.amountKobo - already;
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    const [row] = await tx
      .insert(refund)
      .values({
        orderId: input.orderId,
        paymentId: p.id,
        amountKobo: take,
        reason: input.reason,
        status: "PENDING",
        initiatedByUserId: input.actorUserId ?? null,
      })
      .returning({ id: refund.id });
    ids.push(row.id);
    remaining -= take;
  }
  if (remaining > 0) {
    // Should not happen for real paid orders; never silently ignore it.
    await audit(tx, {
      actorUserId: input.actorUserId,
      action: "refund.unallocated",
      entity: "order",
      entityId: input.orderId,
      data: { unallocatedKobo: remaining, reason: input.reason },
    });
  }
  return ids;
}

/** Send PENDING refunds to the payment provider. Status changes reflect only what the provider reports. */
export async function submitRefunds(refundIds: string[]) {
  for (const id of refundIds) {
    const [r] = await db
      .select({ refund, reference: payment.reference })
      .from(refund)
      .innerJoin(payment, eq(payment.id, refund.paymentId))
      .where(eq(refund.id, id));
    if (!r || r.refund.submittedAt || r.refund.status === "REFUNDED") continue;
    try {
      const res = await getPaymentProvider().refund({
        transactionReference: r.reference,
        amountKobo: r.refund.amountKobo,
        note: r.refund.reason.slice(0, 180),
      });
      await db
        .update(refund)
        .set({ providerRefundId: res.refundId, submittedAt: new Date(), raw: res.raw as never, updatedAt: new Date() })
        .where(eq(refund.id, id));
      await applyRefundResult(id, res, "provider-create");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.transaction(async (tx) => {
        await tx
          .update(refund)
          .set({ status: "FAILED", failureReason: msg, updatedAt: new Date() })
          .where(eq(refund.id, id));
        const o = await tx.query.order.findFirst({ where: eq(order.id, r.refund.orderId) });
        await audit(tx, { actorLabel: "system", action: "refund.submit_failed", entity: "refund", entityId: id, branchId: o?.branchId, data: { error: msg } });
        await notifyStaff(tx, {
          type: "refund.failed",
          title: `Refund failed for ${o?.reference ?? "order"}`,
          body: `${formatNaira(r.refund.amountKobo)} could not be submitted: ${msg}`,
          orderId: r.refund.orderId,
          branchId: o?.branchId,
          link: `/staff/orders/${r.refund.orderId}`,
          permissionKey: "refunds.initiate",
        });
      });
    }
  }
}

/** Apply a provider-reported refund status. Idempotent. REFUNDED is only ever set from a provider result. */
export async function applyRefundResult(refundId: string, res: RefundResult, source: string) {
  await db.transaction(async (tx) => {
    const r = await tx.query.refund.findFirst({ where: eq(refund.id, refundId) });
    if (!r || r.status === "REFUNDED") return;
    const o = await tx.query.order.findFirst({ where: eq(order.id, r.orderId) });
    if (!o) return;

    if (res.status === "processed") {
      const updated = await tx
        .update(refund)
        .set({ status: "REFUNDED", refundedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(refund.id, refundId), ne(refund.status, "REFUNDED")))
        .returning({ id: refund.id });
      if (!updated.length) return;
      const refunded = o.refundedKobo + r.amountKobo;
      await tx
        .update(order)
        .set({
          refundedKobo: refunded,
          paymentStatus: refunded >= o.paidKobo ? "REFUNDED" : "PARTIALLY_REFUNDED",
          updatedAt: new Date(),
        })
        .where(eq(order.id, o.id));
      await audit(tx, { actorLabel: source, action: "refund.refunded", entity: "refund", entityId: refundId, branchId: o.branchId });
      await notifyStaff(tx, {
        type: "refund.refunded",
        title: `Refund completed · ${o.reference}`,
        body: `${formatNaira(r.amountKobo)} refunded to the customer.`,
        orderId: o.id,
        branchId: o.branchId,
        link: `/staff/orders/${o.id}`,
        permissionKey: "orders.view",
      });
      await messageCustomer(tx, o, "refund_completed", { reference: o.reference, amountKobo: r.amountKobo });
    } else if (res.status === "processing" && r.status !== "PROCESSING") {
      await tx.update(refund).set({ status: "PROCESSING", updatedAt: new Date() }).where(eq(refund.id, refundId));
      await audit(tx, { actorLabel: source, action: "refund.processing", entity: "refund", entityId: refundId, branchId: o.branchId });
    } else if (res.status === "failed" && r.status !== "FAILED") {
      await tx
        .update(refund)
        .set({ status: "FAILED", failureReason: "Reported failed by payment provider", updatedAt: new Date() })
        .where(eq(refund.id, refundId));
      await audit(tx, { actorLabel: source, action: "refund.failed", entity: "refund", entityId: refundId, branchId: o.branchId });
      await notifyStaff(tx, {
        type: "refund.failed",
        title: `Refund failed · ${o.reference}`,
        body: `${formatNaira(r.amountKobo)} refund was reported failed by Paystack. Retry from the order page.`,
        orderId: o.id,
        branchId: o.branchId,
        link: `/staff/orders/${o.id}`,
        permissionKey: "refunds.initiate",
      });
    }
  });
}

/** Re-check every submitted, unsettled refund with the provider. */
export async function reconcileRefunds() {
  const open = await db
    .select()
    .from(refund)
    .where(and(inArray(refund.status, ["PENDING", "PROCESSING"]), sql`${refund.providerRefundId} is not null`));
  let updated = 0;
  for (const r of open) {
    try {
      const res = await getPaymentProvider().fetchRefund(r.providerRefundId!);
      await applyRefundResult(r.id, res, "reconcile");
      updated++;
    } catch {
      // leave as-is; will retry on next reconcile
    }
  }
  // Refund rows created but never submitted (e.g. crash between commit and submit).
  const unsent = await db
    .select({ id: refund.id })
    .from(refund)
    .where(and(eq(refund.status, "PENDING"), sql`${refund.submittedAt} is null`, sql`${refund.createdAt} < now() - interval '2 minutes'`));
  if (unsent.length) await submitRefunds(unsent.map((u) => u.id));
  return { checked: open.length, updated, resubmitted: unsent.length };
}

/** Staff retry of a FAILED refund: creates a fresh refund row for the same amount and submits it. */
export async function retryRefund(refundId: string, actorUserId: string) {
  const ids = await db.transaction(async (tx) => {
    const r = await tx.query.refund.findFirst({ where: eq(refund.id, refundId) });
    if (!r || r.status !== "FAILED") throw new Error("Only failed refunds can be retried");
    const o = await tx.query.order.findFirst({ where: eq(order.id, r.orderId) });
    const [row] = await tx
      .insert(refund)
      .values({
        orderId: r.orderId,
        paymentId: r.paymentId,
        amountKobo: r.amountKobo,
        reason: `${r.reason} (retry)`,
        status: "PENDING",
        initiatedByUserId: actorUserId,
      })
      .returning({ id: refund.id });
    await audit(tx, { actorUserId, action: "refund.retry", entity: "refund", entityId: row.id, branchId: o?.branchId, data: { previous: refundId } });
    return [row.id];
  });
  await submitRefunds(ids);
}
