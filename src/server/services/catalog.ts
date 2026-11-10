import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, type DbOrTx } from "@/server/db";
import { branch, branchProduct, category, option, optionGroup, product } from "@/server/db/schema";
import type { CatalogProduct } from "./pricing-core";

export type MenuProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageIsIllustrative: boolean;
  basePriceKobo: number;
  featured: boolean;
  popular: boolean;
  available: boolean;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  groups: {
    id: string;
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: { id: string; name: string; priceDeltaKobo: number }[];
  }[];
};

export type MenuCategory = { id: string; slug: string; name: string; description: string | null; products: MenuProduct[] };

/** Load full catalog as pricing input for a branch. */
export async function loadCatalogForBranch(tx: DbOrTx, branchId: string, productIds?: string[]) {
  const prods = await tx
    .select({
      id: product.id,
      name: product.name,
      basePriceKobo: product.basePriceKobo,
      active: product.active,
      categoryName: category.name,
      categoryActive: category.active,
      available: branchProduct.available,
    })
    .from(product)
    .innerJoin(category, eq(category.id, product.categoryId))
    .leftJoin(branchProduct, and(eq(branchProduct.productId, product.id), eq(branchProduct.branchId, branchId)))
    .where(productIds && productIds.length ? inArray(product.id, productIds) : undefined);

  const ids = prods.map((p) => p.id);
  const groups = ids.length
    ? await tx.select().from(optionGroup).where(inArray(optionGroup.productId, ids)).orderBy(asc(optionGroup.sortOrder))
    : [];
  const gids = groups.map((g) => g.id);
  const opts = gids.length
    ? await tx.select().from(option).where(inArray(option.groupId, gids)).orderBy(asc(option.sortOrder))
    : [];

  const map = new Map<string, CatalogProduct>();
  for (const p of prods) {
    map.set(p.id, {
      id: p.id,
      name: p.name,
      categoryName: p.categoryName,
      basePriceKobo: p.basePriceKobo,
      active: p.active,
      categoryActive: p.categoryActive,
      // No branch_product row = available by default.
      availableAtBranch: p.available ?? true,
      groups: groups
        .filter((g) => g.productId === p.id)
        .map((g) => ({
          id: g.id,
          name: g.name,
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: opts
            .filter((o) => o.groupId === g.id)
            .map((o) => ({ id: o.id, name: o.name, priceDeltaKobo: o.priceDeltaKobo, active: o.active })),
        })),
    });
  }
  return map;
}

/** Public menu for display (active products only, with availability for the chosen branch). */
export async function getMenu(branchId: string | null): Promise<MenuCategory[]> {
  const cats = await db.select().from(category).where(eq(category.active, true)).orderBy(asc(category.sortOrder));
  const prods = await db.select().from(product).where(eq(product.active, true)).orderBy(asc(product.sortOrder));
  const unavailable = await db
    .select({ productId: branchProduct.productId, branchId: branchProduct.branchId })
    .from(branchProduct)
    .where(and(eq(branchProduct.available, false), branchId ? eq(branchProduct.branchId, branchId) : undefined));
  const branchCount = branchId ? 1 : (await db.select({ id: branch.id }).from(branch)).length;

  // Selected branch: unavailable if that branch disabled it. No branch: unavailable only if every branch disabled it.
  const byId = new Map<string, { p: typeof product.$inferSelect; available: boolean }>();
  for (const p of prods) {
    const offCount = unavailable.filter((u) => u.productId === p.id).length;
    byId.set(p.id, { p, available: offCount < branchCount });
  }
  const ids = [...byId.keys()];
  const groups = ids.length
    ? await db.select().from(optionGroup).where(inArray(optionGroup.productId, ids)).orderBy(asc(optionGroup.sortOrder))
    : [];
  const gids = groups.map((g) => g.id);
  const opts = gids.length
    ? await db
        .select()
        .from(option)
        .where(and(inArray(option.groupId, gids), eq(option.active, true)))
        .orderBy(asc(option.sortOrder))
    : [];

  return cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    products: [...byId.values()]
      .filter(({ p }) => p.categoryId === c.id)
      .map(({ p, available }) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        imageIsIllustrative: p.imageIsIllustrative,
        basePriceKobo: p.basePriceKobo,
        featured: p.featured,
        popular: p.popular,
        available,
        categoryId: c.id,
        categorySlug: c.slug,
        categoryName: c.name,
        groups: groups
          .filter((g) => g.productId === p.id)
          .map((g) => ({
            id: g.id,
            name: g.name,
            required: g.required,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            options: opts
              .filter((o) => o.groupId === g.id)
              .map((o) => ({ id: o.id, name: o.name, priceDeltaKobo: o.priceDeltaKobo })),
          })),
      })),
  }));
}

export async function listBranches() {
  return db.select().from(branch).orderBy(asc(branch.name));
}

export async function getBranchBySlug(slug: string) {
  return db.query.branch.findFirst({ where: eq(branch.slug, slug) });
}

/** Most-ordered products over the last N days, from paid orders. */
export async function getPopularProductIds(days = 30, limit = 4): Promise<string[]> {
  const { sql: s } = await import("drizzle-orm");
  const res = await db.execute<{ product_id: string }>(s`
    SELECT oi.product_id, SUM(oi.quantity) AS qty
    FROM order_item oi JOIN "order" o ON o.id = oi.order_id
    WHERE o.payment_status = 'PAID'
      AND o.created_at > now() - make_interval(days => ${days}) AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id ORDER BY qty DESC LIMIT ${limit}`);
  return res.rows.map((r) => r.product_id);
}
