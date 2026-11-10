import Image from "next/image";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/server/db";
import {
  branchProduct,
  category,
  option,
  optionGroup,
  product,
} from "@/server/db/schema";
import { requireStaffPage } from "@/server/auth/guard";
import { saveCategory } from "@/app/actions/menu-admin";
import { formatNaira } from "@/lib/money";
import { ActionForm, Check } from "@/components/admin/forms";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { ButtonLink } from "@/components/ui/button";
import { AvailabilityToggle } from "@/components/admin/availability-toggle";
import { branchesFor } from "@/server/services/staff-view";

export default async function MenuAdmin() {
  const ctx = await requireStaffPage(["menu.manage", "menu.availability"]);
  const canEdit = ctx.permissions.has("menu.manage");
  const [cats, prods, groups, opts, branches, bp] = await Promise.all([
    db.select().from(category).orderBy(asc(category.sortOrder)),
    db.select().from(product).orderBy(asc(product.sortOrder)),
    db.select().from(optionGroup),
    db.select().from(option),
    branchesFor(ctx),
    db.select().from(branchProduct),
  ]);
  // No branch_product row means available.
  const isAvailable = (productId: string, branchId: string) =>
    bp.find((x) => x.productId === productId && x.branchId === branchId)
      ?.available ?? true;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-none">
            Menu
          </h1>
          <p className="max-w-3xl text-sm text-ink-3">
            {canEdit ? "Products, prices, options and photos. " : ""}Use the
            branch switches to mark an item sold out; customers at that branch
            can’t order it until it’s switched back. Changes go live immediately
            and are audit-logged.
          </p>
        </div>
        {canEdit && (
          <ButtonLink href="/admin/menu/new" variant="red">
            <Plus className="size-4" /> New product
          </ButtonLink>
        )}
      </div>
      <div
        className={
          canEdit ? "mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]" : "mt-6"
        }
      >
        <div className="min-w-0 space-y-6">
          {cats.map((c) => (
            <Card key={c.id} className="p-5">
              <h2 className="font-display text-2xl font-bold uppercase">
                {c.name} {!c.active && <Badge tone="red">hidden</Badge>}
              </h2>
              <ul className="mt-3 divide-y divide-line">
                {prods
                  .filter((p) => p.categoryId === c.id)
                  .map((p) => {
                    const pg = groups.filter((g) => g.productId === p.id);
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
                      >
                        <ProductSummary
                          href={canEdit ? `/admin/menu/${p.id}` : null}
                          imageUrl={p.imageUrl}
                          name={p.name}
                          featured={p.featured}
                          hidden={!p.active}
                          options={
                            pg
                              .map(
                                (g) =>
                                  `${g.name}: ${opts
                                    .filter((o) => o.groupId === g.id)
                                    .map(
                                      (o) =>
                                        o.name +
                                        (o.priceDeltaKobo
                                          ? ` (+${formatNaira(o.priceDeltaKobo)})`
                                          : ""),
                                    )
                                    .join(", ")}`,
                              )
                              .join(" · ") || "No options"
                          }
                          price={formatNaira(p.basePriceKobo)}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {branches.map((b) => (
                            <AvailabilityToggle
                              key={b.id}
                              productId={p.id}
                              branchId={b.id}
                              branchName={b.name}
                              available={isAvailable(p.id, b.id)}
                            />
                          ))}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          ))}
        </div>
        {canEdit && (
          <aside className="space-y-4">
            <Card className="p-5">
              <h2 className="font-display text-xl font-bold uppercase">
                Categories
              </h2>
              <div className="mt-3 space-y-4">
                {cats.map((c) => (
                  <details key={c.id} className="rounded-xl bg-paper p-3">
                    <summary className="cursor-pointer font-semibold">
                      {c.name}
                    </summary>
                    <ActionForm
                      action={saveCategory.bind(null, c.id)}
                      className="mt-2 space-y-2"
                    >
                      <Input name="name" defaultValue={c.name} />
                      <Input
                        name="description"
                        defaultValue={c.description ?? ""}
                        placeholder="Description"
                      />
                      <Input
                        name="sortOrder"
                        type="number"
                        defaultValue={c.sortOrder}
                        aria-label="Sort order"
                      />
                      <Check
                        name="active"
                        label="Visible on menu"
                        defaultChecked={c.active}
                      />
                    </ActionForm>
                  </details>
                ))}
                <details className="rounded-xl border border-dashed border-line p-3">
                  <summary className="cursor-pointer font-semibold text-brand-red">
                    + Add category
                  </summary>
                  <ActionForm
                    action={saveCategory.bind(null, null)}
                    className="mt-2 space-y-2"
                    submitLabel="Create"
                  >
                    <Input name="name" placeholder="Name" />
                    <Input name="description" placeholder="Description" />
                    <Input
                      name="sortOrder"
                      type="number"
                      defaultValue={cats.length}
                      aria-label="Sort order"
                    />
                    <Check
                      name="active"
                      label="Visible on menu"
                      defaultChecked
                    />
                  </ActionForm>
                </details>
              </div>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}

function ProductSummary({
  href,
  imageUrl,
  name,
  featured,
  hidden,
  options,
  price,
}: {
  href: string | null;
  imageUrl: string | null;
  name: string;
  featured: boolean;
  hidden: boolean;
  options: string;
  price: string;
}) {
  const body = (
    <>
      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-orange-100">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {name} {featured && <Badge tone="orange">featured</Badge>}{" "}
          {hidden && <Badge tone="red">hidden</Badge>}
        </p>
        <p className="truncate text-xs text-ink-3">{options}</p>
      </div>
      <span className="shrink-0 font-semibold">{price}</span>
    </>
  );
  const cls =
    "flex min-w-[240px] flex-1 items-center gap-3 rounded-xl p-1 -m-1";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-paper`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
