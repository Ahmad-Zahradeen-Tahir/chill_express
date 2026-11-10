import Link from "next/link";
import { Suspense } from "react";
import { requireStaffPage } from "@/server/auth/guard";
import { analyticsScope, getBranchComparison, getHourlyVolume, getOrderTypeSplit, getOverview, getProductPerformance, getTrend, hasDemoData, resolveRange } from "@/server/services/analytics";
import { branchesFor } from "@/server/services/staff-view";
import { formatNaira } from "@/lib/money";
import { AnalyticsFilters } from "@/components/admin/filters";
import { BranchBars, HourlyBars, SalesTrendChart } from "@/components/admin/charts";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/form";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaffPage("analytics.view");
  const sp = await searchParams;
  const branches = await branchesFor(ctx);
  const demoExists = await hasDemoData();
  const includeDemo = sp.demo !== "0";
  const bId = sp.b && branches.some((b) => b.id === sp.b) ? sp.b : null;
  const scope = analyticsScope(ctx, bId, includeDemo);
  const range = resolveRange(sp.r, sp.from, sp.to);
  const [ov, trend, comp, products, hourly, split] = await Promise.all([
    getOverview(scope, range),
    getTrend(scope, range),
    getBranchComparison(scope, range),
    getProductPerformance(scope, range, 8),
    getHourlyVolume(scope, range),
    getOrderTypeSplit(scope, range),
  ]);
  const scopeLabel = bId ? branches.find((b) => b.id === bId)?.name : ctx.branchIds === null ? "All branches" : branches.map((b) => b.name).join(", ");
  const maxQty = Math.max(1, ...products.map((p) => p.qty));
  const delivery = split.find((x) => x.type === "DELIVERY")?.n ?? 0;
  const pickup = split.find((x) => x.type === "PICKUP")?.n ?? 0;

  const kpis: [string, string, string?][] = [
    ["Gross paid sales", formatNaira(ov.grossKobo), "Verified Paystack payments"],
    ["Refunds", formatNaira(ov.refundsKobo), "Confirmed by Paystack"],
    ["Net revenue", formatNaira(ov.netKobo), "Gross minus refunds"],
    ["Average order", formatNaira(ov.aovKobo), "Paid, not rejected/cancelled"],
    ["Total orders", String(ov.totalOrders), `${ov.unpaidOrders} unpaid/abandoned, not counted as revenue`],
    ["Paid orders", String(ov.paidOrders)],
    ["Completed", String(ov.completed)],
    ["Cancelled / rejected", `${ov.cancelled} / ${ov.rejected}`],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">{scopeLabel} · {range.label}</p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Executive dashboard</h1>
        </div>
        <Link href={`/admin/reports?${new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString()}`} className="text-sm font-semibold text-brand-red hover:underline">Export reports →</Link>
      </div>
      <div className="mt-4"><Suspense><AnalyticsFilters branches={branches} showDemoToggle={demoExists} /></Suspense></div>
      {demoExists && includeDemo && (
        <Alert tone="warn" className="mt-4"><strong>Includes demonstration data.</strong> Seeded demo orders are mixed into these figures for the presentation. Untick “Include demo data” to see only real transactions.</Alert>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([l, v, h], i) => (
          <div key={l} className={`rounded-2xl p-4 shadow-card ${i === 2 ? "bg-ink text-white" : "border border-line bg-white"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${i === 2 ? "text-brand-orange" : "text-ink-3"}`}>{l}</p>
            <p className="mt-1 font-display text-3xl font-bold sm:text-4xl">{v}</p>
            {h && <p className={`mt-0.5 text-xs ${i === 2 ? "text-white/60" : "text-ink-3"}`}>{h}</p>}
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Link href="/staff" className="rounded-2xl bg-brand-orange p-4 hover:brightness-95">
          <p className="text-xs font-semibold uppercase tracking-wide">Awaiting approval now</p>
          <p className="font-display text-3xl font-bold">{ov.pendingApprovals}</p>
        </Link>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Refunds in progress / failed</p>
          <p className="font-display text-3xl font-bold">{ov.openRefunds} <span className="text-lg text-ink-3">· {formatNaira(ov.openRefundsKobo)}</span></p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Pickup vs delivery</p>
          <p className="font-display text-3xl font-bold">{pickup} <span className="text-lg text-ink-3">/</span> {delivery}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Sales trend</h2>
          <SalesTrendChart data={trend.points} unit={trend.unit} />
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Best sellers</h2>
          <ol className="mt-3 space-y-3">
            {products.map((p, i) => (
              <li key={p.product}>
                <div className="flex justify-between text-sm"><span><span className="mr-2 font-bold text-ink-3">{i + 1}</span>{p.product}</span><span className="font-semibold">{p.qty} sold</span></div>
                <div className="mt-1 h-2 rounded-full bg-paper"><div className="h-2 rounded-full bg-brand-red" style={{ width: `${(p.qty / maxQty) * 100}%` }} /></div>
                <p className="mt-0.5 text-xs text-ink-3">{formatNaira(p.revenue)} item revenue</p>
              </li>
            ))}
            {!products.length && <li className="text-sm text-ink-3">No sales in this period.</li>}
          </ol>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Branch performance</h2>
          <BranchBars data={comp} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3"><tr><th className="py-2">Branch</th><th className="py-2 pl-3 text-right">Gross</th><th className="py-2 pl-3 text-right">Refunds</th><th className="py-2 pl-3 text-right">Net</th><th className="py-2 pl-3 text-right">Orders</th><th className="py-2 pl-3 text-right">AOV</th><th className="py-2 pl-3 text-right">Cancelled</th></tr></thead>
              <tbody className="divide-y divide-line">
                {comp.map((c) => (
                  <tr key={c.id}><td className="py-2 font-semibold">{c.name}</td><td className="py-2 pl-3 text-right">{formatNaira(c.grossKobo)}</td><td className="py-2 pl-3 text-right">{formatNaira(c.refundsKobo)}</td><td className="py-2 pl-3 text-right font-semibold">{formatNaira(c.netKobo)}</td><td className="py-2 pl-3 text-right">{c.orders}</td><td className="py-2 pl-3 text-right">{formatNaira(c.aovKobo)}</td><td className="py-2 pl-3 text-right">{c.cancelled}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Orders by hour</h2>
          <p className="text-sm text-ink-3">Paid orders, Maiduguri time</p>
          <HourlyBars data={hourly} />
        </Card>
      </div>
    </div>
  );
}
