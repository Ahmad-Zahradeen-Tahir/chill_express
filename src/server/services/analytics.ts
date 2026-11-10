import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import type { StaffContext } from "@/server/auth/permissions";
import { AuthzError } from "@/server/auth/guard";

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
export type Range = { key: RangeKey; from: Date; to: Date; label: string };

const LAGOS_OFFSET = 3600_000; // UTC+1, no DST

function lagosMidnight(daysAgo: number, base = new Date()) {
  const l = new Date(base.getTime() + LAGOS_OFFSET);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() - daysAgo) - LAGOS_OFFSET);
}

export function resolveRange(key: string | undefined, fromStr?: string, toStr?: string): Range {
  const now = new Date();
  switch (key) {
    case "yesterday":
      return { key: "yesterday", from: lagosMidnight(1), to: lagosMidnight(0), label: "Yesterday" };
    case "7d":
      return { key: "7d", from: lagosMidnight(6), to: now, label: "Last 7 days" };
    case "30d":
      return { key: "30d", from: lagosMidnight(29), to: now, label: "Last 30 days" };
    case "month": {
      const l = new Date(now.getTime() + LAGOS_OFFSET);
      return { key: "month", from: new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - LAGOS_OFFSET), to: now, label: "This month" };
    }
    case "custom": {
      const f = fromStr ? new Date(`${fromStr}T00:00:00+01:00`) : null;
      const t = toStr ? new Date(new Date(`${toStr}T00:00:00+01:00`).getTime() + 86400_000) : null;
      if (f && t && !isNaN(+f) && !isNaN(+t) && f < t && +t - +f <= 400 * 86400_000) {
        return { key: "custom", from: f, to: t, label: `${fromStr} → ${toStr}` };
      }
      return { key: "7d", from: lagosMidnight(6), to: now, label: "Last 7 days" };
    }
    case "today":
      return { key: "today", from: lagosMidnight(0), to: now, label: "Today" };
    default:
      return { key: "7d", from: lagosMidnight(6), to: now, label: "Last 7 days" };
  }
}

export type Scope = { branchIds: string[] | null; includeDemo: boolean };

/** Branch scope: requested branch (must be accessible) or every branch the staff member can see. */
export function analyticsScope(ctx: StaffContext, requested: string | null | undefined, includeDemo: boolean): Scope {
  if (requested) {
    if (ctx.branchIds !== null && !ctx.branchIds.includes(requested)) throw new AuthzError("No access to this branch");
    return { branchIds: [requested], includeDemo };
  }
  return { branchIds: ctx.branchIds, includeDemo };
}

function orderScope(s: Scope, alias = "o"): SQL {
  const parts: SQL[] = [];
  if (s.branchIds !== null) {
    parts.push(s.branchIds.length ? sql`${sql.raw(alias)}.branch_id IN (${sql.join(s.branchIds.map((b) => sql`${b}::uuid`), sql`, `)})` : sql`false`);
  }
  if (!s.includeDemo) parts.push(sql`${sql.raw(alias)}.is_demo = false`);
  return parts.length ? sql.join(parts, sql` AND `) : sql`true`;
}

const PAID_OK = sql`o.payment_status <> 'UNPAID'`;

export async function getOverview(s: Scope, r: Range) {
  const scope = orderScope(s);
  const [money] = (
    await db.execute<{ gross: number; refunds: number }>(sql`
      SELECT
        (SELECT coalesce(sum(p.amount_kobo),0)::bigint FROM payment p JOIN "order" o ON o.id = p.order_id
          WHERE p.status = 'SUCCESS' AND p.verified_at >= ${r.from} AND p.verified_at < ${r.to} AND ${scope}) AS gross,
        (SELECT coalesce(sum(f.amount_kobo),0)::bigint FROM refund f JOIN "order" o ON o.id = f.order_id
          WHERE f.status = 'REFUNDED' AND f.refunded_at >= ${r.from} AND f.refunded_at < ${r.to} AND ${scope}) AS refunds`)
  ).rows;
  const [cnt] = (
    await db.execute<{ total: number; paid: number; completed: number; cancelled: number; rejected: number; aov_sum: number; aov_n: number; unpaid: number }>(sql`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE ${PAID_OK})::int AS paid,
        count(*) FILTER (WHERE o.status = 'COMPLETED')::int AS completed,
        count(*) FILTER (WHERE o.status = 'CANCELLED')::int AS cancelled,
        count(*) FILTER (WHERE o.status = 'REJECTED')::int AS rejected,
        count(*) FILTER (WHERE o.status IN ('AWAITING_PAYMENT','PAYMENT_FAILED','EXPIRED'))::int AS unpaid,
        coalesce(sum(o.total_kobo) FILTER (WHERE ${PAID_OK} AND o.status NOT IN ('REJECTED','CANCELLED')),0)::bigint AS aov_sum,
        count(*) FILTER (WHERE ${PAID_OK} AND o.status NOT IN ('REJECTED','CANCELLED'))::int AS aov_n
      FROM "order" o WHERE o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope}`)
  ).rows;
  const [pending] = (
    await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM "order" o WHERE o.status IN ('PENDING_APPROVAL','AWAITING_ADDITIONAL_PAYMENT') AND ${scope}`)
  ).rows;
  const [openRefunds] = (
    await db.execute<{ n: number; amt: number }>(sql`SELECT count(*)::int AS n, coalesce(sum(f.amount_kobo),0)::bigint AS amt FROM refund f JOIN "order" o ON o.id=f.order_id WHERE f.status IN ('PENDING','PROCESSING','FAILED') AND ${scope}`)
  ).rows;
  const gross = Number(money.gross);
  const refunds = Number(money.refunds);
  return {
    grossKobo: gross,
    refundsKobo: refunds,
    netKobo: gross - refunds,
    totalOrders: cnt.total,
    paidOrders: cnt.paid,
    unpaidOrders: cnt.unpaid,
    completed: cnt.completed,
    cancelled: cnt.cancelled,
    rejected: cnt.rejected,
    pendingApprovals: pending.n,
    openRefunds: openRefunds.n,
    openRefundsKobo: Number(openRefunds.amt),
    aovKobo: cnt.aov_n ? Math.round(Number(cnt.aov_sum) / cnt.aov_n / 100) * 100 : 0,
  };
}
export type Overview = Awaited<ReturnType<typeof getOverview>>;

export async function getTrend(s: Scope, r: Range) {
  const scope = orderScope(s);
  const hourly = +r.to - +r.from <= 2 * 86400_000;
  const unit = hourly ? "hour" : "day";
  const rows = (
    await db.execute<{ bucket: string; gross: number; refunds: number; orders: number }>(sql`
      WITH buckets AS (
        SELECT generate_series(date_trunc(${unit}, ${r.from}::timestamptz AT TIME ZONE 'Africa/Lagos'),
                               date_trunc(${unit}, (${r.to}::timestamptz - interval '1 second') AT TIME ZONE 'Africa/Lagos'),
                               ${"1 " + unit}::interval) AS b
      ),
      g AS (SELECT date_trunc(${unit}, p.verified_at AT TIME ZONE 'Africa/Lagos') b, sum(p.amount_kobo) v
            FROM payment p JOIN "order" o ON o.id=p.order_id
            WHERE p.status='SUCCESS' AND p.verified_at >= ${r.from} AND p.verified_at < ${r.to} AND ${scope} GROUP BY 1),
      f AS (SELECT date_trunc(${unit}, f.refunded_at AT TIME ZONE 'Africa/Lagos') b, sum(f.amount_kobo) v
            FROM refund f JOIN "order" o ON o.id=f.order_id
            WHERE f.status='REFUNDED' AND f.refunded_at >= ${r.from} AND f.refunded_at < ${r.to} AND ${scope} GROUP BY 1),
      c AS (SELECT date_trunc(${unit}, o.created_at AT TIME ZONE 'Africa/Lagos') b, count(*) v
            FROM "order" o WHERE ${PAID_OK} AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope} GROUP BY 1)
      SELECT to_char(buckets.b, ${hourly ? "HH24:00" : "YYYY-MM-DD"}) AS bucket,
        coalesce(g.v,0)::bigint AS gross, coalesce(f.v,0)::bigint AS refunds, coalesce(c.v,0)::int AS orders
      FROM buckets LEFT JOIN g ON g.b=buckets.b LEFT JOIN f ON f.b=buckets.b LEFT JOIN c ON c.b=buckets.b
      ORDER BY buckets.b`)
  ).rows;
  return {
    unit,
    points: rows.map((x) => ({ bucket: x.bucket, gross: Number(x.gross), refunds: Number(x.refunds), net: Number(x.gross) - Number(x.refunds), orders: Number(x.orders) })),
  };
}

export async function getBranchComparison(s: Scope, r: Range) {
  const scope = orderScope(s);
  const rows = (
    await db.execute<{ id: string; name: string; gross: number; refunds: number; orders: number; completed: number; cancelled: number; aov_sum: number; aov_n: number }>(sql`
      SELECT b.id, b.name,
        (SELECT coalesce(sum(p.amount_kobo),0) FROM payment p JOIN "order" o ON o.id=p.order_id WHERE o.branch_id=b.id AND p.status='SUCCESS' AND p.verified_at >= ${r.from} AND p.verified_at < ${r.to} AND ${scope})::bigint AS gross,
        (SELECT coalesce(sum(f.amount_kobo),0) FROM refund f JOIN "order" o ON o.id=f.order_id WHERE o.branch_id=b.id AND f.status='REFUNDED' AND f.refunded_at >= ${r.from} AND f.refunded_at < ${r.to} AND ${scope})::bigint AS refunds,
        (SELECT count(*) FROM "order" o WHERE o.branch_id=b.id AND ${PAID_OK} AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope})::int AS orders,
        (SELECT count(*) FROM "order" o WHERE o.branch_id=b.id AND o.status='COMPLETED' AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope})::int AS completed,
        (SELECT count(*) FROM "order" o WHERE o.branch_id=b.id AND o.status IN ('CANCELLED','REJECTED') AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope})::int AS cancelled,
        (SELECT coalesce(sum(o.total_kobo),0) FROM "order" o WHERE o.branch_id=b.id AND ${PAID_OK} AND o.status NOT IN ('REJECTED','CANCELLED') AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope})::bigint AS aov_sum,
        (SELECT count(*) FROM "order" o WHERE o.branch_id=b.id AND ${PAID_OK} AND o.status NOT IN ('REJECTED','CANCELLED') AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope})::int AS aov_n
      FROM branch b
      WHERE ${s.branchIds === null ? sql`true` : s.branchIds.length ? sql`b.id IN (${sql.join(s.branchIds.map((x) => sql`${x}::uuid`), sql`, `)})` : sql`false`}
      ORDER BY b.name`)
  ).rows;
  return rows.map((x) => ({
    id: x.id,
    name: x.name,
    grossKobo: Number(x.gross),
    refundsKobo: Number(x.refunds),
    netKobo: Number(x.gross) - Number(x.refunds),
    orders: x.orders,
    completed: x.completed,
    cancelled: x.cancelled,
    aovKobo: x.aov_n ? Math.round(Number(x.aov_sum) / x.aov_n / 100) * 100 : 0,
  }));
}

export async function getProductPerformance(s: Scope, r: Range, limit = 50) {
  const scope = orderScope(s);
  const rows = (
    await db.execute<{ product: string; category: string; qty: number; revenue: number; orders: number }>(sql`
      SELECT oi.product_name AS product, oi.category_name AS category, sum(oi.quantity)::int AS qty, sum(oi.line_total_kobo)::bigint AS revenue, count(DISTINCT o.id)::int AS orders
      FROM order_item oi JOIN "order" o ON o.id = oi.order_id
      WHERE ${PAID_OK} AND o.status NOT IN ('REJECTED','CANCELLED') AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope}
      GROUP BY 1,2 ORDER BY qty DESC LIMIT ${limit}`)
  ).rows;
  return rows.map((x) => ({ ...x, revenue: Number(x.revenue) }));
}

export async function getVariantPerformance(s: Scope, r: Range) {
  const scope = orderScope(s);
  return (
    await db.execute<{ product: string; variant: string; qty: number }>(sql`
      SELECT oi.product_name AS product, coalesce(string_agg(opt->>'optionName', ' · ' ORDER BY opt->>'groupName'), 'Standard') AS variant, sum(oi.quantity)::int AS qty
      FROM order_item oi JOIN "order" o ON o.id = oi.order_id LEFT JOIN LATERAL jsonb_array_elements(oi.options) opt ON true
      WHERE ${PAID_OK} AND o.status NOT IN ('REJECTED','CANCELLED') AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope}
      GROUP BY oi.id, oi.product_name`)
  ).rows;
}

export async function getHourlyVolume(s: Scope, r: Range) {
  const scope = orderScope(s);
  const rows = (
    await db.execute<{ h: number; n: number }>(sql`
      SELECT extract(hour from o.created_at AT TIME ZONE 'Africa/Lagos')::int h, count(*)::int n
      FROM "order" o WHERE ${PAID_OK} AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope} GROUP BY 1 ORDER BY 1`)
  ).rows;
  return Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, orders: rows.find((x) => x.h === h)?.n ?? 0 }));
}

export async function getOrderTypeSplit(s: Scope, r: Range) {
  const scope = orderScope(s);
  return (
    await db.execute<{ type: string; n: number }>(sql`SELECT o.type, count(*)::int n FROM "order" o WHERE ${PAID_OK} AND o.created_at >= ${r.from} AND o.created_at < ${r.to} AND ${scope} GROUP BY 1`)
  ).rows;
}

export async function hasDemoData() {
  const r = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM "order" WHERE is_demo = true`);
  return (r.rows[0]?.n ?? 0) > 0;
}
