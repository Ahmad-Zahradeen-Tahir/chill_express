import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";
import { formatNaira as fmtNaira } from "@/lib/money";

// Built-in PDF fonts have no ₦ glyph, so PDFs use the ISO code.
const formatNaira = (kobo: number) => fmtNaira(kobo).replace("₦", "NGN ");
import { STATUS_LABELS } from "./order-state";
import type { ReportData } from "./reports";

const RED = "#D30E15";
const ORANGE = "#FBAE14";
const INK = "#1C1410";
const MUTED = "#7C7068";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  band: { backgroundColor: ORANGE, margin: -36, marginBottom: 18, padding: 20, paddingHorizontal: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 9, color: INK, marginTop: 2 },
  warn: { backgroundColor: "#FFF8E8", borderLeft: `3 solid ${ORANGE}`, padding: 6, marginBottom: 10, fontSize: 8.5 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6, color: RED },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kpi: { width: "32.2%", border: "1 solid #ECE4DC", borderRadius: 4, padding: 6 },
  kpiL: { fontSize: 7, color: MUTED, textTransform: "uppercase" },
  kpiV: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
  tr: { flexDirection: "row", borderBottom: "0.5 solid #ECE4DC", paddingVertical: 3 },
  th: { flexDirection: "row", backgroundColor: INK, color: "white", paddingVertical: 4, fontFamily: "Helvetica-Bold" },
  foot: { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 7, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
});

function Table({ cols, rows }: { cols: { label: string; w: number; align?: "right" }[]; rows: (string | number)[][] }) {
  return (
    <View>
      <View style={s.th} fixed>
        {cols.map((c) => <Text key={c.label} style={{ width: `${c.w}%`, paddingHorizontal: 3, textAlign: c.align ?? "left" }}>{c.label}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tr} wrap={false}>
          {r.map((v, j) => <Text key={j} style={{ width: `${cols[j].w}%`, paddingHorizontal: 3, textAlign: cols[j].align ?? "left" }}>{String(v)}</Text>)}
        </View>
      ))}
    </View>
  );
}

function ReportDoc({ d }: { d: ReportData }) {
  const o = d.overview;
  const logo = path.join(process.cwd(), "public/images/brand/logo-dark.png");
  return (
    <Document title={`Chill. Express — ${d.title}`} author="Chill. Express platform">
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <View>
            <Text style={s.title}>{d.title}</Text>
            <Text style={s.sub}>{d.scopeLabel} · {d.period} (Africa/Lagos)</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logo} style={{ width: 110 }} />
        </View>
        {d.includesDemo && <Text style={s.warn}>Includes DEMONSTRATION data: seeded demo orders are included in these figures. Generate with demo data excluded for real trading results.</Text>}
        <View style={s.kpis}>
          {[
            ["Sales", formatNaira(o.grossKobo)],
            ["Average order", formatNaira(o.aovKobo)],
            ["Total orders", o.totalOrders],
            ["Paid orders", o.paidOrders],
            ["Completed", o.completed],
            ["Pending approval now", o.pendingApprovals],
          ].map(([l, v]) => (
            <View key={String(l)} style={s.kpi}><Text style={s.kpiL}>{l}</Text><Text style={s.kpiV}>{String(v)}</Text></View>
          ))}
        </View>
        <Text style={{ fontSize: 7, color: MUTED, marginTop: 4 }}>Sales = payments verified with the payment provider. Unpaid, failed and abandoned checkouts ({o.unpaidOrders}) are never counted as revenue.</Text>

        {d.ops && (
          <>
            <Text style={s.h2}>Operations</Text>
            <Text>Average time from payment to staff approval: {d.ops.avgApprovalMinutes ?? "n/a"} min</Text>
            <Text>Average time from approval to completion: {d.ops.avgFulfilmentMinutes ?? "n/a"} min</Text>
            <Text>Orders awaiting approval right now: {o.pendingApprovals}</Text>
          </>
        )}

        <Text style={s.h2}>Branch comparison</Text>
        <Table
          cols={[{ label: "Branch", w: 24 }, { label: "Sales", w: 20, align: "right" }, { label: "Orders", w: 12, align: "right" }, { label: "Completed", w: 20, align: "right" }, { label: "AOV", w: 24, align: "right" }]}
          rows={d.branches.map((b) => [b.name, formatNaira(b.grossKobo), b.orders, b.completed, formatNaira(b.aovKobo)])}
        />

        {(d.type === "sales" || d.type === "operations") && (
          <>
            <Text style={s.h2}>{d.trendUnit === "hour" ? "Hourly" : "Daily"} sales</Text>
            <Table
              cols={[{ label: d.trendUnit === "hour" ? "Hour" : "Date", w: 25 }, { label: "Sales", w: 45, align: "right" }, { label: "Orders", w: 30, align: "right" }]}
              rows={d.trend.map((p) => [p.bucket, formatNaira(p.gross), p.orders])}
            />
          </>
        )}

        <Text style={s.h2}>Product performance</Text>
        <Table
          cols={[{ label: "Product", w: 34 }, { label: "Category", w: 22 }, { label: "Qty", w: 12, align: "right" }, { label: "Orders", w: 12, align: "right" }, { label: "Item revenue", w: 20, align: "right" }]}
          rows={d.products.slice(0, d.type === "products" ? 100 : 15).map((p) => [p.product, p.category, p.qty, p.orders, formatNaira(p.revenue)])}
        />
        {d.variants.length > 0 && (
          <>
            <Text style={s.h2}>Variations</Text>
            <Table cols={[{ label: "Product — variation", w: 80 }, { label: "Qty", w: 20, align: "right" }]} rows={d.variants.map((v) => [v.variant, v.qty])} />
          </>
        )}
        {d.orders.length > 0 && (
          <>
            <Text style={s.h2}>Orders ({d.orders.length}{d.orders.length >= 20000 ? ", truncated" : ""})</Text>
            <Table
              cols={[{ label: "Reference", w: 15 }, { label: "Placed", w: 19 }, { label: "Branch", w: 13 }, { label: "Type", w: 9 }, { label: "Status", w: 16 }, { label: "Customer", w: 15 }, { label: "Total", w: 13, align: "right" }]}
              rows={d.orders.slice(0, 1500).map((r) => [r.reference, new Date(r.created_at).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lagos" }), r.branch, r.type === "DELIVERY" ? "Delivery" : "Pickup", STATUS_LABELS[r.status], r.customer, formatNaira(r.total)])}
            />
            {d.orders.length > 1500 && <Text style={{ marginTop: 4, color: MUTED }}>PDF lists the latest 1,500 orders. Use the Excel export for the full list.</Text>}
          </>
        )}
        <View style={s.foot} fixed>
          <Text>Chill. Express · generated {d.generatedAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function reportToPdf(d: ReportData): Promise<Buffer> {
  return renderToBuffer(<ReportDoc d={d} />);
}
