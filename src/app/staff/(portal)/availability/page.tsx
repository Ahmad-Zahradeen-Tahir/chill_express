import { Fragment } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/server/db";
import { branchProduct, category, product } from "@/server/db/schema";
import { requireStaffPage } from "@/server/auth/guard";
import { branchesFor } from "@/server/services/staff-view";
import { formatNaira } from "@/lib/money";
import { Alert } from "@/components/ui/form";
import { AvailabilityToggle } from "./toggle";

export default async function AvailabilityPage() {
  const ctx = await requireStaffPage();
  if (!ctx.permissions.has("menu.availability") && !ctx.permissions.has("menu.manage")) return <Alert tone="warn">You don’t have permission to change availability.</Alert>;
  const [branches, cats, prods, bp] = await Promise.all([
    branchesFor(ctx),
    db.select().from(category).orderBy(asc(category.sortOrder)),
    db.select().from(product).orderBy(asc(product.sortOrder)),
    db.select().from(branchProduct),
  ]);
  return (
    <div>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Availability</h1>
      <p className="text-sm text-ink-3">Mark items sold out per branch. Customers see “Unavailable” immediately and can’t order them.</p>
      <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-3">
            <tr><th className="px-4 py-3">Item</th>{branches.map((b) => <th key={b.id} className="px-4 py-3 text-center">{b.name}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cats.map((c) => (
              <Fragment key={c.id}>
                <tr className="bg-paper/60"><td colSpan={branches.length + 1} className="px-4 py-2 font-display text-lg font-bold uppercase">{c.name}</td></tr>
                {prods.filter((p) => p.categoryId === c.id).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5"><span className="font-semibold">{p.name}</span> <span className="text-ink-3">{formatNaira(p.basePriceKobo)}</span>{!p.active && <span className="ml-2 text-xs text-brand-red">(hidden from menu)</span>}</td>
                    {branches.map((b) => (
                      <td key={b.id} className="px-4 py-2.5 text-center">
                        <AvailabilityToggle productId={p.id} branchId={b.id} available={bp.find((x) => x.productId === p.id && x.branchId === b.id)?.available ?? true} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
