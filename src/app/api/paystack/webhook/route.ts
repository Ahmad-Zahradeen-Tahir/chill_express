import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { webhookEvent } from "@/server/db/schema";
import { sha256 } from "@/lib/ids";
import { getPaymentProvider, verifyWebhookSignature } from "@/server/paystack/provider";
import { confirmPayment } from "@/server/services/payments";

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
    }
    await db.update(webhookEvent).set({ processedAt: new Date() }).where(eq(webhookEvent.id, eventId));
  } catch (e) {
    // Acknowledge (so Paystack doesn't hammer us) but record; reconciliation will pick it up.
    await db.update(webhookEvent).set({ error: e instanceof Error ? e.message : String(e) }).where(eq(webhookEvent.id, eventId));
  }
  return NextResponse.json({ ok: true });
}
