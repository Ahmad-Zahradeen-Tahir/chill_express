"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { category, option, optionGroup, product } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/guard";
import { audit } from "@/server/services/audit";
import { saveProductImage } from "@/server/services/uploads";

type R = { ok?: boolean; error?: string };
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const nairaToKobo = z.coerce.number().min(0).max(1_000_000).transform((n) => Math.round(n * 100));
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";

function done() {
  revalidatePath("/", "layout");
}

export async function saveCategory(id: string | null, _: R, form: FormData): Promise<R> {
  const ctx = await requirePermission("menu.manage");
  const p = z.object({ name: z.string().trim().min(2).max(40), description: z.string().trim().max(200).optional(), sortOrder: z.coerce.number().int().min(0).max(999) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const slug = slugify(p.data.name);
  const clash = await db.query.category.findFirst({ where: id ? and(eq(category.slug, slug), ne(category.id, id)) : eq(category.slug, slug) });
  if (clash) return { error: "A category with this name already exists" };
  const values = { name: p.data.name, slug, description: p.data.description || null, sortOrder: p.data.sortOrder, active: bool(form.get("active")), updatedAt: new Date() };
  await db.transaction(async (tx) => {
    if (id) await tx.update(category).set(values).where(eq(category.id, id));
    else await tx.insert(category).values(values);
    await audit(tx, { actorUserId: ctx.userId, action: id ? "menu.category_updated" : "menu.category_created", entity: "category", entityId: id, data: values });
  });
  done();
  return { ok: true };
}

export async function saveProduct(id: string | null, _: R, form: FormData): Promise<R> {
  const ctx = await requirePermission("menu.manage");
  const p = z
    .object({
      name: z.string().trim().min(2).max(60),
      description: z.string().trim().max(300).optional(),
      categoryId: z.string().uuid("Choose a category"),
      basePrice: nairaToKobo,
      sortOrder: z.coerce.number().int().min(0).max(999),
    })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const slug = slugify(p.data.name);
  const clash = await db.query.product.findFirst({ where: id ? and(eq(product.slug, slug), ne(product.id, id)) : eq(product.slug, slug) });
  if (clash) return { error: "A product with this name already exists" };

  let imageUrl: string | undefined;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imageUrl = await saveProductImage(file);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Upload failed" };
    }
  }
  const before = id ? await db.query.product.findFirst({ where: eq(product.id, id) }) : null;
  const values = {
    name: p.data.name,
    slug,
    description: p.data.description || null,
    categoryId: p.data.categoryId,
    basePriceKobo: p.data.basePrice,
    sortOrder: p.data.sortOrder,
    featured: bool(form.get("featured")),
    popular: bool(form.get("popular")),
    active: bool(form.get("active")),
    imageIsIllustrative: imageUrl ? bool(form.get("illustrative")) : bool(form.get("illustrative")),
    ...(imageUrl ? { imageUrl } : {}),
    updatedAt: new Date(),
  };
  let newId = id;
  await db.transaction(async (tx) => {
    if (id) await tx.update(product).set(values).where(eq(product.id, id));
    else newId = (await tx.insert(product).values(values).returning({ id: product.id }))[0].id;
    await audit(tx, {
      actorUserId: ctx.userId,
      action: id ? (before && before.basePriceKobo !== values.basePriceKobo ? "menu.price_changed" : "menu.product_updated") : "menu.product_created",
      entity: "product",
      entityId: newId,
      data: { before: before ? { price: before.basePriceKobo, active: before.active } : null, after: { price: values.basePriceKobo, active: values.active } },
    });
  });
  done();
  if (!id) redirect(`/admin/menu/${newId}`);
  return { ok: true };
}

export async function saveOptionGroup(productId: string, groupId: string | null, _: R, form: FormData): Promise<R> {
  const ctx = await requirePermission("menu.manage");
  const p = z
    .object({ name: z.string().trim().min(1).max(40), maxSelect: z.coerce.number().int().min(1).max(10), sortOrder: z.coerce.number().int().min(0).max(99) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const required = bool(form.get("required"));
  const values = { name: p.data.name, required, minSelect: required ? 1 : 0, maxSelect: p.data.maxSelect, sortOrder: p.data.sortOrder };
  await db.transaction(async (tx) => {
    if (groupId) await tx.update(optionGroup).set(values).where(and(eq(optionGroup.id, groupId), eq(optionGroup.productId, productId)));
    else await tx.insert(optionGroup).values({ ...values, productId });
    await audit(tx, { actorUserId: ctx.userId, action: "menu.option_group_saved", entity: "product", entityId: productId, data: values });
  });
  done();
  return { ok: true };
}

export async function deleteOptionGroup(productId: string, groupId: string) {
  const ctx = await requirePermission("menu.manage");
  await db.transaction(async (tx) => {
    await tx.delete(optionGroup).where(and(eq(optionGroup.id, groupId), eq(optionGroup.productId, productId)));
    await audit(tx, { actorUserId: ctx.userId, action: "menu.option_group_deleted", entity: "product", entityId: productId, data: { groupId } });
  });
  done();
}

export async function saveOption(groupId: string, optionId: string | null, _: R, form: FormData): Promise<R> {
  const ctx = await requirePermission("menu.manage");
  const p = z.object({ name: z.string().trim().min(1).max(40), priceDelta: nairaToKobo, sortOrder: z.coerce.number().int().min(0).max(99) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const values = { name: p.data.name, priceDeltaKobo: p.data.priceDelta, sortOrder: p.data.sortOrder, active: bool(form.get("active")) };
  const g = await db.query.optionGroup.findFirst({ where: eq(optionGroup.id, groupId) });
  if (!g) return { error: "Group not found" };
  await db.transaction(async (tx) => {
    if (optionId) await tx.update(option).set(values).where(and(eq(option.id, optionId), eq(option.groupId, groupId)));
    else await tx.insert(option).values({ ...values, groupId });
    await audit(tx, { actorUserId: ctx.userId, action: "menu.option_saved", entity: "product", entityId: g.productId, data: values });
  });
  done();
  return { ok: true };
}

export async function deleteOption(groupId: string, optionId: string) {
  const ctx = await requirePermission("menu.manage");
  await db.transaction(async (tx) => {
    // Options referenced by past orders are kept in order snapshots, so deletion is safe.
    await tx.delete(option).where(and(eq(option.id, optionId), eq(option.groupId, groupId)));
    await audit(tx, { actorUserId: ctx.userId, action: "menu.option_deleted", entity: "option", entityId: optionId });
  });
  done();
}
