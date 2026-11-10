import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { savedAddress } from "@/server/db/schema";
import { requireCustomerPage } from "@/server/auth/guard";
import { isStaffRole } from "@/server/auth/permissions";
import { listCustomerOrders } from "@/server/services/orders";
import { ACTIVE_STATUSES } from "@/server/services/order-state";
import { formatNaira } from "@/lib/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { signOut } from "@/app/actions/auth";
import { AccountForms, DeleteAddressButton } from "./forms";

export const metadata: Metadata = { title: "My account" };

/** Abandoned/expired checkouts older than an hour are noise for the customer. */
function hideStaleUnpaid<T extends { status: string; createdAt: Date }>(orders: T[]): T[] {
  const cutoff = Date.now() - 3600_000;
  return orders.filter((o) => !["AWAITING_PAYMENT", "EXPIRED"].includes(o.status) || o.createdAt.getTime() > cutoff);
}

export default async function AccountPage() {
  const u = await requireCustomerPage("/account");
  if (isStaffRole(u.role)) redirect("/staff");
  const [orders, addresses] = await Promise.all([listCustomerOrders(u.id), db.select().from(savedAddress).where(eq(savedAddress.userId, u.id))]);
  const visible = hideStaleUnpaid(orders);
  const active = visible.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const past = visible.filter((o) => !ACTIVE_STATUSES.includes(o.status));
  const row = (o: (typeof orders)[number]) => (
    <li key={o.id}>
      <Link href={`/order/${o.reference}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card hover:ring-2 hover:ring-brand-orange">
        <span>
          <span className="block font-display text-xl font-bold">{o.reference}</span>
          <span className="text-xs text-ink-3">{o.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })} · {o.type === "DELIVERY" ? "Delivery" : "Pickup"}</span>
        </span>
        <span className="text-right">
          <span className="block font-semibold">{formatNaira(o.totalKobo)}</span>
          <StatusBadge status={o.status} />
        </span>
      </Link>
    </li>
  );
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {active.length > 0 && <AutoRefresh seconds={20} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">My account</p>
          <h1 className="font-display text-6xl font-extrabold uppercase leading-none">Hi, {u.name.split(" ")[0]}</h1>
        </div>
        <form action={signOut}><button className="text-sm font-semibold text-ink-3 hover:text-brand-red">Sign out</button></form>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section>
            <h2 className="font-display text-3xl font-bold uppercase">Active orders</h2>
            {active.length ? <ul className="mt-3 space-y-3">{active.map(row)}</ul> : <p className="mt-2 text-ink-3">No active orders. <Link href="/menu" className="font-semibold text-brand-red">Order now</Link></p>}
          </section>
          <section>
            <h2 className="font-display text-3xl font-bold uppercase">Order history</h2>
            {past.length ? <ul className="mt-3 space-y-3">{past.slice(0, 30).map(row)}</ul> : <p className="mt-2 text-ink-3">No past orders yet.</p>}
          </section>
        </div>
        <aside className="space-y-6">
          <AccountForms name={u.name} phone={u.phone ?? ""} email={u.email} />
          <div className="rounded-3xl bg-white p-6 shadow-card">
            <h2 className="font-display text-2xl font-bold uppercase">Saved addresses</h2>
            <ul className="mt-3 space-y-2">
              {addresses.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 rounded-2xl bg-paper p-3 text-sm">
                  <span><strong>{a.label}</strong><span className="block text-ink-3">{a.address}</span>{a.landmark && <span className="block text-xs text-ink-3">Landmark: {a.landmark}</span>}</span>
                  <DeleteAddressButton id={a.id} />
                </li>
              ))}
              {!addresses.length && <li className="text-sm text-ink-3">No saved addresses.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
