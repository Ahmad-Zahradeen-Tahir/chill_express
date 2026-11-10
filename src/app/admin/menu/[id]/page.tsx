import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { category, option, optionGroup, product } from "@/server/db/schema";
import { requireStaffPage } from "@/server/auth/guard";
import { saveOption, saveOptionGroup, saveProduct } from "@/app/actions/menu-admin";
import { ActionForm, Check } from "@/components/admin/forms";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { DeleteGroup, DeleteOption } from "./deletes";

export default async function ProductEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("menu.manage");
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = isNew ? null : await db.query.product.findFirst({ where: eq(product.id, id) });
  if (!isNew && !p) notFound();
  const cats = await db.select().from(category).orderBy(asc(category.sortOrder));
  const groups = p ? await db.select().from(optionGroup).where(eq(optionGroup.productId, p.id)).orderBy(asc(optionGroup.sortOrder)) : [];
  const opts = groups.length ? await db.select().from(option).where(inArray(option.groupId, groups.map((g) => g.id))).orderBy(asc(option.sortOrder)) : [];
  const naira = (k: number) => (k / 100).toString();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/menu" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-3 hover:text-ink"><ArrowLeft className="size-4" /> Menu</Link>
      <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none">{p?.name ?? "New product"}</h1>

      <Card className="mt-6 p-5">
        <ActionForm action={saveProduct.bind(null, p?.id ?? null)} submitLabel={isNew ? "Create product" : "Save product"} variant="red">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2"><Input name="name" defaultValue={p?.name} required /></Field>
              <Field label="Category">
                <Select name="categoryId" defaultValue={p?.categoryId ?? cats[0]?.id}>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Base price (₦)" hint="For items with sizes, the smallest size's price."><Input name="basePrice" type="number" step="50" min="0" defaultValue={p ? naira(p.basePriceKobo) : ""} required /></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea name="description" rows={2} defaultValue={p?.description ?? ""} /></Field>
              <Field label="Sort order"><Input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} /></Field>
              <div className="flex flex-wrap items-end gap-4 pb-2">
                <Check name="active" label="On menu" defaultChecked={p?.active ?? true} />
                <Check name="featured" label="Featured" defaultChecked={p?.featured} />
                <Check name="popular" label="Popular" defaultChecked={p?.popular} />
              </div>
            </div>
            <div>
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-orange-100">{p?.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="220px" className="object-cover" />}</div>
              <Field label="Photo (JPG/PNG/WebP, max 4 MB)" className="mt-2"><input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-xs" /></Field>
              <div className="mt-2"><Check name="illustrative" label="Mark as illustrative (not the exact item)" defaultChecked={p?.imageIsIllustrative ?? true} /></div>
            </div>
          </div>
        </ActionForm>
      </Card>

      {p && (
        <Card className="mt-6 p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Options & variations</h2>
          <p className="text-sm text-ink-3">e.g. Protein (required), Size (required, price per size), Extras like cheese (optional). Option prices are added to the base price.</p>
          <div className="mt-4 space-y-4">
            {groups.map((g) => (
              <div key={g.id} className="rounded-2xl bg-paper p-4">
                <ActionForm action={saveOptionGroup.bind(null, p.id, g.id)} submitLabel="Save group" className="flex flex-wrap items-end gap-3">
                  <Field label="Group name"><Input name="name" defaultValue={g.name} className="w-44" /></Field>
                  <Field label="Max choices"><Input name="maxSelect" type="number" min="1" defaultValue={g.maxSelect} className="w-24" /></Field>
                  <Field label="Order"><Input name="sortOrder" type="number" defaultValue={g.sortOrder} className="w-20" /></Field>
                  <div className="pb-3"><Check name="required" label="Required" defaultChecked={g.required} /></div>
                </ActionForm>
                <div className="mt-2"><DeleteGroup productId={p.id} groupId={g.id} /></div>
                <ul className="mt-3 space-y-2">
                  {opts.filter((o) => o.groupId === g.id).map((o) => (
                    <li key={o.id} className="rounded-xl bg-white p-3">
                      <ActionForm action={saveOption.bind(null, g.id, o.id)} submitLabel="Save" className="flex flex-wrap items-end gap-3">
                        <Field label="Option"><Input name="name" defaultValue={o.name} className="w-40" /></Field>
                        <Field label="+ Price (₦)"><Input name="priceDelta" type="number" step="50" min="0" defaultValue={naira(o.priceDeltaKobo)} className="w-28" /></Field>
                        <Field label="Order"><Input name="sortOrder" type="number" defaultValue={o.sortOrder} className="w-20" /></Field>
                        <div className="pb-3"><Check name="active" label="Available" defaultChecked={o.active} /></div>
                      </ActionForm>
                      <div className="mt-1"><DeleteOption groupId={g.id} optionId={o.id} /></div>
                    </li>
                  ))}
                </ul>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-red">+ Add option</summary>
                  <ActionForm action={saveOption.bind(null, g.id, null)} submitLabel="Add option" className="mt-2 flex flex-wrap items-end gap-3">
                    <Field label="Option"><Input name="name" className="w-40" /></Field>
                    <Field label="+ Price (₦)"><Input name="priceDelta" type="number" step="50" min="0" defaultValue="0" className="w-28" /></Field>
                    <Field label="Order"><Input name="sortOrder" type="number" defaultValue={opts.filter((o) => o.groupId === g.id).length} className="w-20" /></Field>
                    <div className="pb-3"><Check name="active" label="Available" defaultChecked /></div>
                  </ActionForm>
                </details>
              </div>
            ))}
            <details className="rounded-2xl border border-dashed border-line p-4">
              <summary className="cursor-pointer font-semibold text-brand-red">+ Add option group</summary>
              <ActionForm action={saveOptionGroup.bind(null, p.id, null)} submitLabel="Add group" className="mt-2 flex flex-wrap items-end gap-3">
                <Field label="Group name"><Input name="name" className="w-44" placeholder="e.g. Size" /></Field>
                <Field label="Max choices"><Input name="maxSelect" type="number" min="1" defaultValue="1" className="w-24" /></Field>
                <Field label="Order"><Input name="sortOrder" type="number" defaultValue={groups.length} className="w-20" /></Field>
                <div className="pb-3"><Check name="required" label="Required" /></div>
              </ActionForm>
            </details>
          </div>
        </Card>
      )}
    </div>
  );
}
