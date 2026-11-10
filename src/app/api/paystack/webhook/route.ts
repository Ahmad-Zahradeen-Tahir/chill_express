import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { payment, refund, webhookEvent } from "@/server/db/schema";
import { sha256 } from "@/lib/ids";
import { getPaymentProvider, verifyWebhookSignature } from "@/server/paystack/provider";
import { confirmPayment } from "@/server/services/payments";
import { applyRefundResult } from "@/server/services/refunds";

type PaystackEvent = { event: string; data: Record<string, unknown> };

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const provider = getPaymentProvider();
  if (!verifyWebhookSignature(raw, req.headers.get("x-paystack-signature"), provider.webhookSecret())) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let evt: PaystackEvent;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Idempotency: identical deliveries are recorded once and processed once.
  const inserted = await db
    .insert(webhookEvent)
    .values({ provider: provider.name, eventKey: sha256(raw), event: String(evt.event), payload: evt as never })
    .onConflictDoNothing()
    .returning({ id: webhookEvent.id });
  if (!inserted.length) return NextResponse.json({ ok: true, duplicate: true });
  const eventId = inserted[0].id;

  try {
    if (evt.event === "charge.success") {
      const ref = String(evt.data.reference ?? "");
      if (ref) await confirmPayment(ref, "webhook"); // re-verifies with the provider
    } else if (evt.event.startsWith("refund.")) {
      await handleRefundEvent(evt.data);
    }
    await db.update(webhookEvent).set({ processedAt: new Date() }).where(eq(webhookEvent.id, eventId));
  } catch (e) {
    // Acknowledge (so Paystack doesn't hammer us) but record; reconciliation will pick it up.
    await db.update(webhookEvent).set({ error: e instanceof Error ? e.message : String(e) }).where(eq(webhookEvent.id, eventId));
  }
  return NextResponse.json({ ok: true });
}

async function handleRefundEvent(data: Record<string, unknown>) {
  const providerId = data.id != null ? String(data.id) : data.refund_reference != null ? String(data.refund_reference) : null;
  const txRef = data.transaction_reference != null ? String(data.transaction_reference) : null;
  let rows = providerId ? await db.select().from(refund).where(eq(refund.providerRefundId, providerId)) : [];
  if (!rows.length && txRef) {
    const p = await db.query.payment.findFirst({ where: eq(payment.reference, txRef) });
    if (p) rows = await db.select().from(refund).where(and(eq(refund.paymentId, p.id), inArray(refund.status, ["PENDING", "PROCESSING"])));
  }
  for (const r of rows) {
    if (!r.providerRefundId) continue;
    // Never trust the webhook body for refund state: fetch it from the provider.
    const res = await getPaymentProvider().fetchRefund(r.providerRefundId);
    await applyRefundResult(r.id, res, "webhook");
  }
}
