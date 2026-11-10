import Image from "next/image";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/server/db";
import { category, option, optionGroup, product } from "@/server/db/schema";
import { requireStaffPage } from "@/server/auth/guard";
import { saveCategory } from "@/app/actions/menu-admin";
import { formatNaira } from "@/lib/money";
import { ActionForm, Check } from "@/components/admin/forms";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { ButtonLink } from "@/components/ui/button";

export default async function MenuAdmin() {
  await requireStaffPage("menu.manage");
  const [cats, prods, groups, opts] = await Promise.all([
    db.select().from(category).orderBy(asc(category.sortOrder)),
    db.select().from(product).orderBy(asc(product.sortOrder)),
    db.select().from(optionGroup),
    db.select().from(option),
  ]);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Menu</h1>
          <p className="text-sm text-ink-3">Products, prices, options and photos. Changes go live immediately and are audit-logged. Past orders keep the prices they were paid at.</p>
        </div>
        <ButtonLink href="/admin/menu/new" variant="red"><Plus className="size-4" /> New product</ButtonLink>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {cats.map((c) => (
            <Card key={c.id} className="p-5">
              <h2 className="font-display text-2xl font-bold uppercase">{c.name} {!c.active && <Badge tone="red">hidden</Badge>}</h2>
              <ul className="mt-3 divide-y divide-line">
                {prods.filter((p) => p.categoryId === c.id).map((p) => {
                  const pg = groups.filter((g) => g.productId === p.id);
                  return (
                    <li key={p.id}>
                      <Link href={`/admin/menu/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-paper">
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-orange-100">{p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="56px" className="object-cover" />}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{p.name} {p.featured && <Badge tone="orange">featured</Badge>} {!p.active && <Badge tone="red">hidden</Badge>}</p>
                          <p className="truncate text-xs text-ink-3">{pg.map((g) => `${g.name}: ${opts.filter((o) => o.groupId === g.id).map((o) => o.name + (o.priceDeltaKobo ? ` (+${formatNaira(o.priceDeltaKobo)})` : "")).join(", ")}`).join(" · ") || "No options"}</p>
                        </div>
                        <span className="font-semibold">{formatNaira(p.basePriceKobo)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-display text-xl font-bold uppercase">Categories</h2>
            <div className="mt-3 space-y-4">
              {cats.map((c) => (
                <details key={c.id} className="rounded-xl bg-paper p-3">
                  <summary className="cursor-pointer font-semibold">{c.name}</summary>
                  <ActionForm action={saveCategory.bind(null, c.id)} className="mt-2 space-y-2">
                    <Input name="name" defaultValue={c.name} />
                    <Input name="description" defaultValue={c.description ?? ""} placeholder="Description" />
                    <Input name="sortOrder" type="number" defaultValue={c.sortOrder} aria-label="Sort order" />
                    <Check name="active" label="Visible on menu" defaultChecked={c.active} />
                  </ActionForm>
                </details>
              ))}
              <details className="rounded-xl border border-dashed border-line p-3">
                <summary className="cursor-pointer font-semibold text-brand-red">+ Add category</summary>
                <ActionForm action={saveCategory.bind(null, null)} className="mt-2 space-y-2" submitLabel="Create">
                  <Input name="name" placeholder="Name" />
                  <Input name="description" placeholder="Description" />
                  <Input name="sortOrder" type="number" defaultValue={cats.length} aria-label="Sort order" />
                  <Check name="active" label="Visible on menu" defaultChecked />
                </ActionForm>
              </details>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
