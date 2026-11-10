import { desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLog, user } from "@/server/db/schema";
import { requireStaffPage } from "@/server/auth/guard";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireStaffPage("staff.manage");
  const { q } = await searchParams;
  const scope = ctx.branchIds === null ? undefined : or(isNull(auditLog.branchId), ctx.branchIds.length ? inArray(auditLog.branchId, ctx.branchIds) : sql`false`);
  const where = q ? sql`${scope ?? sql`true`} AND (${auditLog.action} ILIKE ${"%" + q + "%"} OR ${auditLog.entityId} ILIKE ${"%" + q + "%"})` : scope;
  const rows = await db.select({ a: auditLog, actor: user.name }).from(auditLog).leftJoin(user, eq(user.id, auditLog.actorUserId)).where(where).orderBy(desc(auditLog.createdAt)).limit(300);
  return (
    <div>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Audit log</h1>
      <p className="text-sm text-ink-3">Every approval, rejection, modification, refund, price change, staff change and export.</p>
      <form className="mt-4 flex max-w-md gap-2"><Input name="q" defaultValue={q} placeholder="Filter by action, e.g. order.reject" /><Button variant="dark">Filter</Button></form>
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-3"><tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Who</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Entity</th><th className="px-4 py-2.5">Details</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ a, actor }) => (
              <tr key={a.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2 text-ink-3">{a.createdAt.toLocaleString("en-NG", { dateStyle: "short", timeStyle: "medium", timeZone: "Africa/Lagos" })}</td>
                <td className="px-4 py-2">{actor ?? a.actorLabel ?? "system"}</td>
                <td className="px-4 py-2 font-mono text-xs">{a.action}</td>
                <td className="px-4 py-2 text-xs">{a.entity}{a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ""}</td>
                <td className="max-w-md truncate px-4 py-2 font-mono text-[11px] text-ink-3" title={a.data ? JSON.stringify(a.data) : ""}>{a.data ? JSON.stringify(a.data).slice(0, 140) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
