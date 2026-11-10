import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guard";
import { listStaffOrders } from "@/server/services/staff-orders";
import { branchesFor, lagosDayStart } from "@/server/services/staff-view";
import { STAFF_VISIBLE_STATUSES, STATUS_LABELS } from "@/server/services/order-state";
import type { OrderStatus } from "@/server/db/schema/enums";
import { formatNaira } from "@/lib/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/card";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaffPage("orders.view");
  const sp = await searchParams;
  const branches = await branchesFor(ctx);
  const b = sp.b && branches.some((x) => x.id === sp.b) ? sp.b : null;
  const status = sp.s && (STAFF_VISIBLE_STATUSES as string[]).includes(sp.s) ? (sp.s as OrderStatus) : null;
  const type = sp.t === "PICKUP" || sp.t === "DELIVERY" ? sp.t : null;
  const from = sp.from ? new Date(sp.from + "T00:00:00+01:00") : sp.from === "" ? null : lagosDayStart(6);
  const to = sp.to ? new Date(new Date(sp.to + "T00:00:00+01:00").getTime() + 86400000) : null;
  const orders = await listStaffOrders(ctx, { branchId: b, status, type, from: from && !isNaN(+from) ? from : null, to: to && !isNaN(+to) ? to : null, q: sp.q?.trim() || null }, 300);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">All orders</h1>
      <form className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-line">
        <label className="min-w-0 flex-[2_1_220px]">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Search</span>
          <Input name="q" defaultValue={sp.q} placeholder="Ref, name or phone" />
        </label>
        <label className="min-w-0 flex-[1_1_180px]">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Branch</span>
          <Select name="b" defaultValue={b ?? ""}>
            <option value="">All my branches</option>
            {branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </label>
        <label className="min-w-0 flex-[1_1_180px]">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Status</span>
          <Select name="s" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {STAFF_VISIBLE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </Select>
        </label>
        <label className="min-w-0 flex-[1_1_180px]">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Type</span>
          <Select name="t" defaultValue={type ?? ""}>
            <option value="">Pickup & delivery</option>
            <option value="PICKUP">Pickup</option>
            <option value="DELIVERY">Delivery</option>
          </Select>
        </label>
        <div className="flex min-w-0 flex-[2_1_380px] flex-wrap items-end gap-2">
        <label className="min-w-0 flex-[1_1_140px]">
          <span className="mb-1 block text-xs font-semibold text-ink-3">From</span>
          <Input type="date" name="from" defaultValue={sp.from ?? (from ? fmtDate(new Date(from.getTime() + 3600_000)) : "")} />
        </label>
        <label className="min-w-0 flex-[1_1_140px]">
          <span className="mb-1 block text-xs font-semibold text-ink-3">To</span>
          <Input type="date" name="to" defaultValue={sp.to ?? ""} />
        </label>
        <Button type="submit" variant="dark" className="shrink-0">Filter</Button>
        </div>
      </form>
      <p className="mt-3 text-sm text-ink-3">{orders.length} order{orders.length === 1 ? "" : "s"}{orders.length === 300 ? " (showing latest 300)" : ""}</p>
      <div className="mt-2 overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-3">
            <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Placed</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-paper">
                <td className="px-4 py-2.5"><Link href={`/staff/orders/${o.id}`} className="font-semibold hover:text-brand-red">{o.reference}</Link>{o.isDemo && <Badge className="ml-2">demo</Badge>}</td>
                <td className="px-4 py-2.5 text-ink-2">{o.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}</td>
                <td className="px-4 py-2.5">{o.branchName}</td>
                <td className="px-4 py-2.5">{o.customerName}<span className="block text-xs text-ink-3">{o.customerPhone}</span></td>
                <td className="px-4 py-2.5">{o.type === "DELIVERY" ? "Delivery" : "Pickup"}</td>
                <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-2.5 text-right font-semibold">{formatNaira(o.totalKobo)}</td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-3">No orders match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
