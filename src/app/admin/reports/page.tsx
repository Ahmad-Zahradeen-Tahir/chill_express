import { Suspense } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { requireStaffPage } from "@/server/auth/guard";
import { hasDemoData, resolveRange } from "@/server/services/analytics";
import { REPORT_TYPES } from "@/server/services/reports";
import { branchesFor } from "@/server/services/staff-view";
import { AnalyticsFilters } from "@/components/admin/filters";
import { Card } from "@/components/ui/card";

const DESC: Record<keyof typeof REPORT_TYPES, string> = {
  sales: "Gross paid sales, refunds and net revenue with a daily breakdown and branch comparison.",
  orders: "Every order in the period with status, customer, totals, payments and refunds.",
  products: "Units sold and item revenue per product, plus a breakdown by variation (size, protein, cheese).",
  operations: "Approval and fulfilment times, cancellations, pending approvals and refund backlog.",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaffPage("reports.export");
  const sp = await searchParams;
  const branches = await branchesFor(ctx);
  const range = resolveRange(sp.r, sp.from, sp.to);
  const demo = await hasDemoData();
  const qs = new URLSearchParams(Object.entries({ r: sp.r, from: sp.from, to: sp.to, b: sp.b, demo: sp.demo }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">{range.label}{sp.b ? ` · ${branches.find((b) => b.id === sp.b)?.name ?? ""}` : " · all your branches"}</p>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Reports</h1>
      <div className="mt-4"><Suspense><AnalyticsFilters branches={branches} showDemoToggle={demo} /></Suspense></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(Object.keys(REPORT_TYPES) as (keyof typeof REPORT_TYPES)[]).map((t) => (
          <Card key={t} className="flex flex-col p-5">
            <h2 className="font-display text-2xl font-bold uppercase">{REPORT_TYPES[t]}</h2>
            <p className="mt-1 flex-1 text-sm text-ink-3">{DESC[t]}</p>
            <div className="mt-4 flex gap-2">
              <a href={`/api/reports/${t}?${qs}&format=pdf`} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-red px-4 text-sm font-semibold text-white hover:bg-red-700"><FileText className="size-4" /> PDF</a>
              <a href={`/api/reports/${t}?${qs}&format=xlsx`} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-2"><FileSpreadsheet className="size-4" /> Excel</a>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-3"><Download className="size-3.5" /> Exports use the period, branch and demo-data settings above. Each export is recorded in the audit log.</p>
    </div>
  );
}
