import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { getTrackableOrder } from "@/server/services/tracking";
import { getOrderDetail } from "@/server/services/orders";
import { getSettings } from "@/server/services/site";
import { formatNaira } from "@/lib/money";
import { describeOptions } from "@/server/services/pricing-core";
import { STATUS_LABELS } from "@/server/services/order-state";
import type { OrderStatus } from "@/server/db/schema/enums";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Alert } from "@/components/ui/form";
import { RefundBadge } from "@/components/ui/status-badge";
import { buttonClass } from "@/components/ui/button";
import { PayAgainButton } from "./pay-again";

export const metadata: Metadata = { title: "Your order" };

const CUSTOMER_COPY: Partial<Record<OrderStatus, string>> = {
  AWAITING_PAYMENT: "Waiting for your payment to be confirmed.",
  PAYMENT_FAILED: "Your payment didn't go through. You have not been charged for this attempt.",
  EXPIRED: "This order was not paid in time and has been closed.",
  PENDING_APPROVAL: "Payment received! The branch is reviewing your order now.",
  AWAITING_ADDITIONAL_PAYMENT: "The branch updated your order and needs a small extra payment before continuing.",
  CONFIRMED: "Your order has been accepted and is queued for the kitchen.",
  PREPARING: "Your food is being prepared.",
  READY_FOR_PICKUP: "Your order is ready! Head to the branch to collect it.",
  OUT_FOR_DELIVERY: "Your order is on its way.",
  COMPLETED: "Order completed. Enjoy your meal!",
  REJECTED: "Sorry — the branch couldn't accept this order. Your payment is being refunded.",
  CANCELLED: "This order was cancelled. Your payment is being refunded.",
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string; payment?: string }> }) {
  const [{ ref }, sp] = await Promise.all([params, searchParams]);
  const access = await getTrackableOrder(ref, sp.t);
  const settings = await getSettings();
  if (!access.order || !access.allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-5xl font-extrabold uppercase">Find your order</h1>
        <p className="mt-2 text-ink-3">For your privacy, enter your order reference and phone number to view this order.</p>
        <Link href={`/track?ref=${encodeURIComponent(ref)}`} className={buttonClass("red", "lg", "mt-6 w-full")}>Look up order</Link>
      </div>
    );
  }
  const d = (await getOrderDetail(access.order.id))!;
  const o = d.order;
  const steps: OrderStatus[] = ["PENDING_APPROVAL", "CONFIRMED", "PREPARING", o.type === "DELIVERY" ? "OUT_FOR_DELIVERY" : "READY_FOR_PICKUP", "COMPLETED"];
  const reached = new Set(d.history.map((h) => h.toStatus));
  const terminalBad = ["REJECTED", "CANCELLED", "EXPIRED", "PAYMENT_FAILED"].includes(o.status);
  const live = !["COMPLETED", "REJECTED", "CANCELLED", "EXPIRED"].includes(o.status);
  const additional = d.payments.find((p) => p.purpose === "ADDITIONAL" && p.status === "INITIALIZED");
  const shareLink = access.token ? `/order/${o.reference}?t=${access.token}` : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {live && <AutoRefresh seconds={15} />}
      {sp.payment === "failed" && <Alert tone="error" className="mb-4">Payment was not completed. You can try again below.</Alert>}
      {sp.payment === "pending" && <Alert tone="info" className="mb-4">We’re still waiting for Paystack to confirm your payment. This page updates automatically.</Alert>}

      <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">{d.branch.name} · {o.type === "DELIVERY" ? "Delivery" : "Pickup"}</p>
      <h1 className="font-display text-6xl font-extrabold uppercase leading-none">{o.reference}</h1>

      <div className={`mt-6 rounded-3xl p-6 ${terminalBad ? "bg-red-50" : o.status === "COMPLETED" ? "bg-success-50" : "dots bg-brand-orange"}`}>
        <p className="font-display text-4xl font-extrabold uppercase leading-none">{STATUS_LABELS[o.status]}</p>
        <p className="mt-2 text-ink-2">{CUSTOMER_COPY[o.status]}</p>
        {o.rejectionReason && <p className="mt-1 text-sm text-ink-2">Reason: {o.rejectionReason}</p>}
        {(o.status === "AWAITING_PAYMENT" || o.status === "PAYMENT_FAILED") && <PayAgainButton reference={o.reference} amount={formatNaira(o.totalKobo)} />}
        {additional?.authorizationUrl && o.status === "AWAITING_ADDITIONAL_PAYMENT" && (
          <a href={additional.authorizationUrl} className={buttonClass("red", "lg", "mt-4")}>Pay extra {formatNaira(additional.amountKobo)}</a>
        )}
      </div>

      {!terminalBad && (
        <ol className="mt-8 space-y-0">
          {steps.map((s, i) => {
            const done = reached.has(s) || o.status === "COMPLETED";
            const current = o.status === s;
            const at = d.history.filter((h) => h.toStatus === s).at(-1)?.createdAt;
            return (
              <li key={s} className="flex gap-4">
                <div className="flex flex-col items-center">
                  {done ? <CheckCircle2 className={`size-7 ${current ? "text-brand-red" : "text-success"}`} /> : <Circle className="size-7 text-line" />}
                  {i < steps.length - 1 && <span className={`w-0.5 flex-1 ${done ? "bg-success" : "bg-line"}`} />}
                </div>
                <div className="pb-6">
                  <p className={`font-semibold ${current ? "text-brand-red" : done ? "" : "text-ink-3"}`}>{STATUS_LABELS[s]}</p>
                  {at && <p className="text-xs text-ink-3">{at.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {d.refunds.length > 0 && (
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl font-bold uppercase">Refund</h2>
          {d.refunds.map((r) => (
            <div key={r.id} className="mt-2 flex items-center justify-between text-sm">
              <span>{formatNaira(r.amountKobo)}</span>
              <RefundBadge status={r.status} />
            </div>
          ))}
          <p className="mt-2 text-xs text-ink-3">Refunds go back to your original payment method. Bank processing times vary.</p>
        </div>
      )}

      <div className="mt-6 rounded-3xl bg-white p-6 shadow-card">
        <h2 className="font-display text-2xl font-bold uppercase">Your order</h2>
        <ul className="mt-3 divide-y divide-line">
          {d.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
              <span><strong>{i.quantity}×</strong> {i.productName}{i.options.length > 0 && <span className="block text-xs text-ink-3">{describeOptions(i.options)}</span>}</span>
              <span className="font-semibold">{formatNaira(i.lineTotalKobo)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink-3">Subtotal</dt><dd>{formatNaira(o.subtotalKobo)}</dd></div>
          {o.deliveryFeeKobo > 0 && <div className="flex justify-between"><dt className="text-ink-3">Delivery</dt><dd>{formatNaira(o.deliveryFeeKobo)}</dd></div>}
          <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatNaira(o.totalKobo)}</dd></div>
        </dl>
        {d.delivery && (
          <div className="mt-4 rounded-2xl bg-paper p-4 text-sm">
            <p className="font-semibold">Delivering to</p>
            <p>{d.delivery.address}</p>
            {d.delivery.landmark && <p className="text-ink-3">Landmark: {d.delivery.landmark}</p>}
          </div>
        )}
        {o.type === "PICKUP" && o.pickupTime && <p className="mt-4 flex items-center gap-2 text-sm"><Clock className="size-4" /> Pickup: {o.pickupTime === "ASAP" ? "As soon as possible" : o.pickupTime}</p>}
      </div>

      <div className="mt-6 text-sm text-ink-3">
        {shareLink && <p>Keep this page bookmarked to check your order status from this device.</p>}
        <p className="mt-1">Questions? Call <a className="font-semibold text-brand-red" href={settings.phoneHref}>{settings.phone}</a> and quote <strong>{o.reference}</strong>.</p>
      </div>
    </div>
  );
}
