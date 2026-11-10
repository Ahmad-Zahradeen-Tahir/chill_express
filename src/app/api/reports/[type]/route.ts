import { NextResponse, type NextRequest } from "next/server";
import { AuthzError, requirePermission } from "@/server/auth/guard";
import { analyticsScope, resolveRange } from "@/server/services/analytics";
import { buildReport, REPORT_TYPES, reportToXlsx, type ReportType } from "@/server/services/reports";
import { reportToPdf } from "@/server/services/report-pdf";
import { branchesFor } from "@/server/services/staff-view";
import { audit } from "@/server/services/audit";
import { db } from "@/server/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!(type in REPORT_TYPES)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  try {
    const ctx = await requirePermission("reports.export");
    const q = req.nextUrl.searchParams;
    const branches = await branchesFor(ctx);
    const b = q.get("b") || null;
    const scope = analyticsScope(ctx, b, q.get("demo") !== "0");
    const range = resolveRange(q.get("r") ?? undefined, q.get("from") ?? undefined, q.get("to") ?? undefined);
    const label = b ? (branches.find((x) => x.id === b)?.name ?? "Branch") : ctx.branchIds === null ? "All branches" : branches.map((x) => x.name).join(", ");
    const data = await buildReport(type as ReportType, scope, range, label);
    const format = q.get("format") === "pdf" ? "pdf" : "xlsx";
    const body = format === "pdf" ? await reportToPdf(data) : await reportToXlsx(data);
    await audit(db, { actorUserId: ctx.userId, action: "report.exported", entity: "report", entityId: type, branchId: b, data: { format, range: range.label, includeDemo: scope.includeDemo } });
    const fname = `chill-express-${type}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${range.from.toISOString().slice(0, 10)}.${format}`;
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "content-type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${fname}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: e.code === "UNAUTHENTICATED" ? 401 : 403 });
    console.error("report failed", e);
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
