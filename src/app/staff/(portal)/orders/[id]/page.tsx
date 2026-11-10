import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { user, auditLog } from "@/server/db/schema";
import { desc } from "drizzle-orm";
import { requireStaffPage } from "@/server/auth/guard";
import { canAccessBranch } from "@/server/auth/permissions";
import { getOrderDetail } from "@/server/services/orders";
import { allowedActions } from "@/server/services/staff-view";
import { STATUS_LABELS } from "@/server/services/order-state";
import { describeOptions } from "@/server/services/pricing-core";
import { getMenu } from "@/server/services/catalog";
import { formatNaira } from "@/lib/money";
import { RefundBadge, StatusBadge } from "@/components/ui/status-badge";
import { Badge, Card } from "@/components/ui/card";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { OrderActions } from "@/components/portal/order-actions";
import { OrderTools } from "./tools";
import { ModifyOrder } from "./modify";

const dt = (d: Date) => d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export default async function StaffOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("orders.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getOrderDetail(id);
  // Branch-level authorization: staff from another branch get a 404, not the data.
  if (!d || !canAccessBranch(ctx, d.order.branchId)) notFound();
  const o = d.order;
  const actorIds = [...new Set([...d.history.map((h) => h.actorUserId), ...d.modifications.map((m) => m.actorUserId), ...d.refunds.map((r) => r.initiatedByUserId)].filter(Boolean) as string[])];
  const actors = actorIds.length ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, actorIds)) : [];
  const who = (uid: string | null) => (uid ? (actors.find((a) => a.id === uid)?.name ?? "Staff") : "System");
  const relatedIds = [o.id, ...d.payments.map((p) => p.id), ...d.refunds.map((r) => r.id)];
  const audits = await db.select().from(auditLog).where(inArray(auditLog.entityId, relatedIds)).orderBy(desc(auditLog.createdAt)).limit(40);
  const canModify = ctx.permissions.has("orders.modify") && ["PENDING_APPROVAL", "CONFIRMED", "PREPARING"].includes(o.status);
  const menu = canModify ? await getMenu(o.branchId) : [];
  const live = !["COMPLETED", "REJECTED", "CANCELLED", "EXPIRED"].includes(o.status);
  const pendingExtra = d.payments.find((p) => p.purpose === "ADDITIONAL" && p.status === "INITIALIZED");

  return (
    <div>
      {live && <AutoRefresh seconds={10} />}
      <Link href="/staff" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-ink"><ArrowLeft className="size-4" /> Queue</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">{o.reference}</h1>
        <StatusBadge status={o.status} />
        {o.isDemo && <Badge>Demo data</Badge>}
      </div>
      <p className="mt-1 text-sm text-ink-3">{d.branch.name} · {o.type === "DELIVERY" ? "Delivery" : "Pickup"} · placed {dt(o.createdAt)}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-5">
            <OrderActions orderId={o.id} actions={allowedActions(ctx, o)} size="md" />
            {o.status === "AWAITING_ADDITIONAL_PAYMENT" && (
              <div className="mt-3 rounded-2xl bg-orange-50 p-3 text-sm">
                On hold: waiting for the customer to pay <strong>{formatNaira(pendingExtra?.amountKobo ?? 0)}</strong> extra. They see a pay button on their tracking page.
                {pendingExtra?.authorizationUrl && <span className="mt-1 block break-all text-xs text-ink-3">Payment link: {pendingExtra.authorizationUrl}</span>}
              </div>
            )}
            {!allowedActions(ctx, o).length && o.status !== "AWAITING_ADDITIONAL_PAYMENT" && <p className="text-sm text-ink-3">No actions available for this order{live ? " with your permissions" : ""}.</p>}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-2xl font-bold uppercase">Items</h2>
            <ul className="mt-2 divide-y divide-line">
              {d.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2.5">
                  <span><strong>{i.quantity}×</strong> {i.productName}{i.options.length > 0 && <span className="block text-sm text-ink-3">{describeOptions(i.options)}</span>}</span>
                  <span className="text-right"><span className="font-semibold">{formatNaira(i.lineTotalKobo)}</span><span className="block text-xs text-ink-3">{formatNaira(i.unitPriceKobo)} each</span></span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-3">Subtotal</dt><dd>{formatNaira(o.subtotalKobo)}</dd></div>
              {o.deliveryFeeKobo > 0 && <div className="flex justify-between"><dt className="text-ink-3">Delivery fee</dt><dd>{formatNaira(o.deliveryFeeKobo)}</dd></div>}
              <div className="flex justify-between text-base font-bold"><dt>Order total</dt><dd>{formatNaira(o.totalKobo)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Paid (verified)</dt><dd>{formatNaira(o.paidKobo)}</dd></div>
              {o.refundedKobo > 0 && <div className="flex justify-between"><dt className="text-ink-3">Refunded (confirmed)</dt><dd>-{formatNaira(o.refundedKobo)}</dd></div>}
            </dl>
          </Card>

          {canModify && (
            <ModifyOrder
              order={{ id: o.id, type: o.type, customerName: o.customerName, customerPhone: o.customerPhone, customerEmail: o.customerEmail, pickupTime: o.pickupTime, totalKobo: o.totalKobo, deliveryFeeKobo: o.deliveryFeeKobo }}
              delivery={d.delivery}
              items={d.items.map((i) => ({ id: i.id, productId: i.productId, name: i.productName, options: describeOptions(i.options), optionIds: i.options.map((x) => x.optionId), unitPriceKobo: i.unitPriceKobo, quantity: i.quantity }))}
              menu={menu}
            />
          )}

          <Card className="p-5">
            <h2 className="font-display text-2xl font-bold uppercase">Timeline</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
              {d.history.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="font-semibold">{STATUS_LABELS[h.toStatus]}</p>
                  <p className="text-xs text-ink-3">{dt(h.createdAt)} · {who(h.actorUserId)}{h.note ? ` · ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Card>

          {d.modifications.length > 0 && (
            <Card className="p-5">
              <h2 className="font-display text-2xl font-bold uppercase">Modifications</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {d.modifications.map((m) => (
                  <li key={m.id} className="rounded-xl bg-paper p-3">
                    <p className="font-semibold">{m.reason} <Badge className="ml-1">{m.status.replace("_", " ").toLowerCase()}</Badge></p>
                    <p className="text-xs text-ink-3">{dt(m.createdAt)} · {who(m.actorUserId)} · change {m.deltaKobo >= 0 ? "+" : ""}{formatNaira(m.deltaKobo)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="font-display text-2xl font-bold uppercase">Customer</h2>
            <p className="mt-2 font-semibold">{o.customerName}</p>
            <a href={`tel:${o.customerPhone.replace(/[^\d+]/g, "")}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red"><Phone className="size-4" /> {o.customerPhone}</a>
            {o.customerEmail && <p className="text-sm text-ink-3">{o.customerEmail}</p>}
            <p className="mt-1 text-xs text-ink-3">{o.customerUserId ? "Registered customer" : "Guest checkout"}</p>
            {o.type === "PICKUP" && <p className="mt-3 text-sm"><strong>Pickup:</strong> {o.pickupTime === "ASAP" || !o.pickupTime ? "As soon as possible" : o.pickupTime}</p>}
            {d.delivery && (
              <div className="mt-3 rounded-xl bg-paper p-3 text-sm">
                <p className="font-semibold">Delivery address</p>
                <p>{d.delivery.address}</p>
                {d.delivery.landmark && <p className="text-ink-3">Landmark: {d.delivery.landmark}</p>}
                {d.delivery.instructions && <p className="text-ink-3">Note: {d.delivery.instructions}</p>}
              </div>
            )}
            {o.rejectionReason && <p className="mt-3 text-sm text-brand-red">Reason: {o.rejectionReason}</p>}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-2xl font-bold uppercase">Payments</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {d.payments.map((p) => (
                <li key={p.id} className="rounded-xl bg-paper p-3">
                  <div className="flex justify-between"><span className="font-semibold">{formatNaira(p.amountKobo)} · {p.purpose === "ORDER" ? "Order" : "Extra"}</span><Badge tone={p.status === "SUCCESS" ? "green" : p.status === "INITIALIZED" ? "orange" : "red"}>{p.status.toLowerCase()}</Badge></div>
                  <p className="break-all text-xs text-ink-3">{p.provider === "DEMO_SEED" ? "Demo record (not a real transaction)" : p.provider === "DEV_SIM" ? "Simulated payment" : "Paystack"} · {p.reference}</p>
                  {p.verifiedAt && <p className="text-xs text-ink-3">Verified {dt(p.verifiedAt)}{p.channel ? ` · ${p.channel}` : ""}</p>}
                  {p.failureReason && <p className="text-xs text-brand-red">{p.failureReason}</p>}
                </li>
              ))}
            </ul>
            {d.refunds.length > 0 && (
              <>
                <h3 className="mt-4 font-display text-xl font-bold uppercase">Refunds</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {d.refunds.map((r) => (
                    <li key={r.id} className="rounded-xl bg-paper p-3">
                      <div className="flex justify-between"><span className="font-semibold">{formatNaira(r.amountKobo)}</span><RefundBadge status={r.status} /></div>
                      <p className="text-xs text-ink-3">{r.reason}</p>
                      <p className="text-xs text-ink-3">Started {dt(r.createdAt)} by {who(r.initiatedByUserId)}{r.refundedAt ? ` · refunded ${dt(r.refundedAt)}` : ""}</p>
                      {r.failureReason && <p className="text-xs text-brand-red">{r.failureReason}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <OrderTools orderId={o.id} failedRefundIds={d.refunds.filter((r) => r.status === "FAILED").map((r) => r.id)} canRefund={ctx.permissions.has("refunds.initiate")} canWithdraw={o.status === "AWAITING_ADDITIONAL_PAYMENT" && ctx.permissions.has("orders.modify")} />
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-2xl font-bold uppercase">Audit trail</h2>
            <ul className="mt-2 space-y-1.5 text-xs">
              {audits.map((a) => (
                <li key={a.id} className="flex justify-between gap-2"><span className="font-mono">{a.action}</span><span className="text-ink-3">{dt(a.createdAt)} · {a.actorUserId ? who(a.actorUserId) : a.actorLabel}</span></li>
              ))}
              {!audits.length && <li className="text-ink-3">No audit entries.</li>}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
