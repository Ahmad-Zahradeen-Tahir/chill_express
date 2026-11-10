import Link from "next/link";
import { Bike, Store } from "lucide-react";
import { requireStaffPage } from "@/server/auth/guard";
import { listItemsForOrders, listStaffOrders, type StaffOrderRow } from "@/server/services/staff-orders";
import { allowedActions, branchesFor, lagosDayStart, timeAgo } from "@/server/services/staff-view";
import { describeOptions } from "@/server/services/pricing-core";
import { formatNaira } from "@/lib/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { OrderActions } from "@/components/portal/order-actions";
import { NewOrderAlert } from "@/components/portal/new-order-alert";
import { BranchTabs } from "@/components/portal/branch-tabs";
import { Alert } from "@/components/ui/form";
import type { OrderStatus } from "@/server/db/schema/enums";

export default async function StaffQueue({ searchParams }: { searchParams: Promise<{ b?: string; denied?: string }> }) {
  const ctx = await requireStaffPage();
  const sp = await searchParams;
  if (!ctx.permissions.has("orders.view")) return <Alert tone="warn">Your account does not have access to orders.</Alert>;
  const branches = await branchesFor(ctx);
  const b = sp.b && branches.some((x) => x.id === sp.b) ? sp.b : null;
  const [active, today] = await Promise.all([
    listStaffOrders(ctx, { branchId: b, status: "ACTIVE" }),
    listStaffOrders(ctx, { branchId: b, from: lagosDayStart(0) }),
  ]);
  const items = await listItemsForOrders(active.map((o) => o.id));
  const by = (s: OrderStatus[]) => active.filter((o) => s.includes(o.status)).sort((x, y) => +x.createdAt - +y.createdAt);
  const cols: { title: string; tone: string; orders: StaffOrderRow[] }[] = [
    { title: "Awaiting approval", tone: "bg-brand-orange", orders: by(["PENDING_APPROVAL", "AWAITING_ADDITIONAL_PAYMENT"]) },
    { title: "Confirmed", tone: "bg-sky-500", orders: by(["CONFIRMED"]) },
    { title: "Preparing", tone: "bg-ink", orders: by(["PREPARING"]) },
    { title: "Ready / out for delivery", tone: "bg-success", orders: by(["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"]) },
  ];
  const paidToday = today.filter((o) => o.paymentStatus !== "UNPAID");
  const stats = [
    ["Orders today", String(paidToday.length)],
    ["Completed", String(today.filter((o) => o.status === "COMPLETED").length)],
    ["Paid today", formatNaira(paidToday.reduce((s, o) => s + o.paidKobo, 0))],
  ];

  return (
    <div>
      <AutoRefresh seconds={8} />
      {sp.denied && <Alert tone="warn" className="mb-4">You don’t have permission to open that page.</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Live queue</h1>
          <p className="text-sm text-ink-3">Paid orders only. New orders must be approved before the kitchen starts. Updates every few seconds.</p>
        </div>
        <NewOrderAlert pendingIds={cols[0].orders.map((o) => o.id)} />
      </div>
      <div className="mt-4"><BranchTabs branches={branches} current={b} base="/staff" /></div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{l}</p>
            <p className="mt-1 font-display text-3xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        {cols.map((c) => (
          <section key={c.title} className="rounded-3xl bg-white/60 p-3 ring-1 ring-line">
            <h2 className="mb-3 flex items-center justify-between px-1">
              <span className="flex items-center gap-2 font-display text-xl font-bold uppercase"><span className={`size-2.5 rounded-full ${c.tone}`} /> {c.title}</span>
              <span className="rounded-full bg-ink/5 px-2 text-sm font-bold">{c.orders.length}</span>
            </h2>
            <div className="space-y-3">
              {c.orders.length === 0 && <p className="px-1 py-6 text-center text-sm text-ink-3">Nothing here</p>}
              {c.orders.map((o) => (
                <article key={o.id} className={`rounded-2xl bg-white p-4 shadow-card ring-1 ${o.status === "PENDING_APPROVAL" ? "ring-brand-orange" : "ring-line"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/staff/orders/${o.id}`} className="font-display text-xl font-bold hover:text-brand-red">{o.reference}</Link>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                    {o.type === "DELIVERY" ? <Bike className="size-3.5" /> : <Store className="size-3.5" />}
                    {o.type === "DELIVERY" ? "Delivery" : "Pickup ASAP"} · {timeAgo(o.createdAt)}
                    {!b && branches.length > 1 && <> · {o.branchName}</>}
                    {o.isDemo && <span className="rounded bg-ink/5 px-1 font-semibold">DEMO</span>}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {items.filter((i) => i.orderId === o.id).map((i) => (
                      <li key={i.id}><strong>{i.quantity}×</strong> {i.productName}{i.options.length > 0 && <span className="text-ink-3"> · {describeOptions(i.options)}</span>}</li>
                    ))}
                  </ul>
                  <p className="mt-2 flex justify-between text-sm"><span className="text-ink-3">{o.customerName}</span><strong>{formatNaira(o.totalKobo)}</strong></p>
                  <OrderActions orderId={o.id} actions={allowedActions(ctx, o)} className="mt-3" />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
