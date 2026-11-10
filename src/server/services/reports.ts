import "server-only";
import { sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { formatNaira } from "@/lib/money";
import { STATUS_LABELS } from "./order-state";
import type { OrderStatus } from "@/server/db/schema/enums";
import { getBranchComparison, getOverview, getProductPerformance, getTrend, getVariantPerformance, type Range, type Scope } from "./analytics";

export const REPORT_TYPES = {
  sales: "Sales report",
  orders: "Order report",
  products: "Product performance",
  operations: "Operational summary",
} as const;
export type ReportType = keyof typeof REPORT_TYPES;

export type ReportData = Awaited<ReturnType<typeof buildReport>>;

async function orderRows(s: Scope, r: Range) {
  const parts = [sql`o.created_at >= ${r.from} AND o.created_at < ${r.to}`];
  if (s.branchIds !== null) parts.push(s.branchIds.length ? sql`o.branch_id IN (${sql.join(s.branchIds.map((b) => sql`${b}::uuid`), sql`, `)})` : sql`false`);
  if (!s.includeDemo) parts.push(sql`o.is_demo = false`);
  return (
    await db.execute<{ reference: string; created_at: Date; branch: string; type: string; status: OrderStatus; customer: string; phone: string; items: number; total: number; paid: number; is_demo: boolean }>(sql`
      SELECT o.reference, o.created_at, b.name AS branch, o.type, o.status, o.customer_name AS customer, o.customer_phone AS phone,
        (SELECT coalesce(sum(quantity),0) FROM order_item WHERE order_id=o.id)::int AS items, o.total_kobo AS total, o.paid_kobo AS paid, o.is_demo
      FROM "order" o JOIN branch b ON b.id=o.branch_id WHERE ${sql.join(parts, sql` AND `)} ORDER BY o.created_at DESC LIMIT 20000`)
  ).rows;
}

async function operations(s: Scope, r: Range) {
  const parts = [sql`o.created_at >= ${r.from} AND o.created_at < ${r.to}`, sql`o.approved_at IS NOT NULL`];
  if (s.branchIds !== null) parts.push(s.branchIds.length ? sql`o.branch_id IN (${sql.join(s.branchIds.map((b) => sql`${b}::uuid`), sql`, `)})` : sql`false`);
  if (!s.includeDemo) parts.push(sql`o.is_demo = false`);
  const [t] = (
    await db.execute<{ approve_min: number | null; complete_min: number | null }>(sql`
      SELECT round(avg(extract(epoch from (o.approved_at - o.paid_at))/60)::numeric,1)::float AS approve_min,
             round(avg(extract(epoch from (o.completed_at - o.approved_at))/60) FILTER (WHERE o.completed_at IS NOT NULL)::numeric,1)::float AS complete_min
      FROM "order" o WHERE ${sql.join(parts, sql` AND `)}`)
  ).rows;
  return { avgApprovalMinutes: t?.approve_min ?? null, avgFulfilmentMinutes: t?.complete_min ?? null };
}

export async function buildReport(type: ReportType, s: Scope, r: Range, scopeLabel: string) {
  const [overview, branches, products, trend] = await Promise.all([getOverview(s, r), getBranchComparison(s, r), getProductPerformance(s, r, 100), getTrend(s, r)]);
  const orders = type === "orders" ? await orderRows(s, r) : [];
  const variants = type === "products" ? await getVariantPerformance(s, r) : [];
  const variantAgg = new Map<string, number>();
  for (const v of variants) variantAgg.set(`${v.product} — ${v.variant}`, (variantAgg.get(`${v.product} — ${v.variant}`) ?? 0) + v.qty);
  const ops = type === "operations" ? await operations(s, r) : null;
  return {
    type,
    title: REPORT_TYPES[type],
    scopeLabel,
    period: `${fmtDate(r.from)} – ${fmtDate(new Date(+r.to - 1))}`,
    generatedAt: new Date(),
    includesDemo: s.includeDemo,
    overview,
    branches,
    products,
    variants: [...variantAgg.entries()].map(([k, qty]) => ({ variant: k, qty })).sort((a, b) => b.qty - a.qty),
    trend: trend.points,
    trendUnit: trend.unit,
    orders,
    ops,
  };
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}
function fmtDateTime(d: Date) {
  return d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
}

const NAIRA_FMT = '"₦"#,##0.00';

export async function reportToXlsx(d: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Chill. Express platform";
  wb.created = d.generatedAt;
  const head = (ws: ExcelJS.Worksheet, cols: { header: string; key: string; width: number; money?: boolean }[]) => {
    ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: NAIRA_FMT } : {} }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD30E15" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const n = (kobo: number) => kobo / 100;

  const sum = wb.addWorksheet("Summary");
  sum.addRows([
    ["Chill. Express — " + d.title],
    ["Scope", d.scopeLabel],
    ["Period (Africa/Lagos)", d.period],
    ["Generated", fmtDateTime(d.generatedAt)],
    ["Includes demonstration data", d.includesDemo ? "YES — seeded demo orders are included" : "No"],
    [],
    ["Sales (verified payments)", n(d.overview.grossKobo)],
    ["Average order value", n(d.overview.aovKobo)],
    ["Total orders (incl. unpaid attempts)", d.overview.totalOrders],
    ["Paid orders", d.overview.paidOrders],
    ["Completed orders", d.overview.completed],
    ["Unpaid / abandoned (not revenue)", d.overview.unpaidOrders],
  ]);
  sum.getRow(1).font = { bold: true, size: 14 };
  [7, 8].forEach((r) => (sum.getCell(`B${r}`).numFmt = NAIRA_FMT));
  sum.getColumn(1).width = 42;
  sum.getColumn(2).width = 40;
  if (d.ops) {
    sum.addRow([]);
    sum.addRow(["Avg minutes from payment to approval", d.ops.avgApprovalMinutes ?? "n/a"]);
    sum.addRow(["Avg minutes from approval to completion", d.ops.avgFulfilmentMinutes ?? "n/a"]);
  }

  const br = wb.addWorksheet("Branches");
  head(br, [
    { header: "Branch", key: "name", width: 20 },
    { header: "Sales", key: "gross", width: 16, money: true },
    { header: "Paid orders", key: "orders", width: 12 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "Avg order", key: "aov", width: 14, money: true },
  ]);
  d.branches.forEach((b) => br.addRow({ name: b.name, gross: n(b.grossKobo), orders: b.orders, completed: b.completed, aov: n(b.aovKobo) }));

  if (d.type === "sales" || d.type === "operations") {
    const t = wb.addWorksheet(d.trendUnit === "hour" ? "Hourly" : "Daily");
    head(t, [
      { header: d.trendUnit === "hour" ? "Hour" : "Date", key: "bucket", width: 14 },
      { header: "Sales", key: "gross", width: 16, money: true },
      { header: "Paid orders", key: "orders", width: 12 },
    ]);
    d.trend.forEach((p) => t.addRow({ bucket: p.bucket, gross: n(p.gross), orders: p.orders }));
  }

  const pr = wb.addWorksheet("Products");
  head(pr, [
    { header: "Product", key: "product", width: 26 },
    { header: "Category", key: "category", width: 16 },
    { header: "Qty sold", key: "qty", width: 10 },
    { header: "Orders", key: "orders", width: 10 },
    { header: "Item revenue", key: "revenue", width: 16, money: true },
  ]);
  d.products.forEach((p) => pr.addRow({ ...p, revenue: n(p.revenue) }));

  if (d.variants.length) {
    const v = wb.addWorksheet("Variations");
    head(v, [
      { header: "Product — variation", key: "variant", width: 44 },
      { header: "Qty sold", key: "qty", width: 10 },
    ]);
    d.variants.forEach((x) => v.addRow(x));
  }

  if (d.orders.length) {
    const o = wb.addWorksheet("Orders");
    head(o, [
      { header: "Reference", key: "reference", width: 16 },
      { header: "Placed", key: "placed", width: 20 },
      { header: "Branch", key: "branch", width: 14 },
      { header: "Type", key: "type", width: 10 },
      { header: "Status", key: "status", width: 20 },
      { header: "Customer", key: "customer", width: 22 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Items", key: "items", width: 8 },
      { header: "Total", key: "total", width: 14, money: true },
      { header: "Paid", key: "paid", width: 14, money: true },
      { header: "Demo", key: "demo", width: 8 },
    ]);
    d.orders.forEach((r) =>
      o.addRow({ ...r, placed: fmtDateTime(new Date(r.created_at)), status: STATUS_LABELS[r.status], total: n(r.total), paid: n(r.paid), demo: r.is_demo ? "yes" : "" }),
    );
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export { formatNaira };
