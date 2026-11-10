"use server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { payment } from "@/server/db/schema";
import { isSimulatedPayments, signWebhook } from "@/server/paystack/provider";
import { simStore } from "@/server/paystack/sim-store";

/** SIMULATOR ONLY: decide the outcome of a simulated payment, then fire a signed webhook exactly like Paystack would. */
export async function simulateOutcome(reference: string, outcome: "success" | "failed") {
  if (!isSimulatedPayments()) throw new Error("Simulator disabled");
  const p = await db.query.payment.findFirst({ where: eq(payment.reference, reference) });
  if (!p || p.provider !== "DEV_SIM") throw new Error("Unknown simulated payment");
  await simStore.setOutcome(reference, outcome);
  if (outcome === "success") {
    const body = JSON.stringify({ event: "charge.success", data: { reference, amount: p.amountKobo, currency: "NGN", simulated: true } });
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    // Deliver the webhook (exercises signature + idempotency). The browser callback will also verify; only one wins.
    await fetch(`${appUrl}/api/paystack/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-paystack-signature": signWebhook(body, process.env.DEV_SIM_SECRET!) },
      body,
    }).catch(() => null);
  }
  return { redirect: `/api/payments/callback?reference=${encodeURIComponent(reference)}` };
}
