import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { order, payment } from "@/server/db/schema";
import { isSimulatedPayments } from "@/server/paystack/provider";
import { formatNaira } from "@/lib/money";
import { SimButtons } from "./sim-buttons";

export const dynamic = "force-dynamic";

export default async function SimulatedPaymentPage({ params }: { params: Promise<{ ref: string }> }) {
  if (!isSimulatedPayments()) notFound();
  const { ref } = await params;
  const p = await db.query.payment.findFirst({ where: eq(payment.reference, decodeURIComponent(ref)) });
  if (!p || p.provider !== "DEV_SIM") notFound();
  const o = await db.query.order.findFirst({ where: eq(order.id, p.orderId) });
  return (
    <div className="min-h-dvh bg-ink px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border-2 border-dashed border-brand-orange p-4 text-center">
          <p className="font-display text-3xl font-extrabold uppercase text-brand-orange">Simulated payment</p>
          <p className="mt-1 text-sm text-white/80">This is NOT Paystack and no money moves. It stands in for Paystack test mode until test keys are configured.</p>
        </div>
        <div className="mt-6 rounded-3xl bg-white p-6 text-ink">
          <p className="text-sm text-ink-3">{p.purpose === "ADDITIONAL" ? "Additional payment for order" : "Payment for order"}</p>
          <p className="font-display text-3xl font-bold">{o?.reference}</p>
          <p className="mt-4 text-sm text-ink-3">Amount</p>
          <p className="font-display text-5xl font-extrabold">{formatNaira(p.amountKobo)}</p>
          <p className="mt-1 text-xs text-ink-3">Reference: {p.reference}</p>
          <SimButtons reference={p.reference} done={p.status !== "INITIALIZED"} />
        </div>
      </div>
    </div>
  );
}
