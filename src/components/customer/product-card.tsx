"use client";
import { Check, Minus, Plus, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { MenuProduct } from "@/server/services/catalog";
import { formatNaira } from "@/lib/money";
import { useCart } from "@/lib/client/cart-store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

function fromPrice(p: MenuProduct) {
  // "From" price = base + cheapest required options.
  return p.basePriceKobo + p.groups.filter((g) => g.required).reduce((s, g) => s + Math.min(...g.options.map((o) => o.priceDeltaKobo), 0), 0);
}

export function ProductImage({ p, sizes, className }: { p: Pick<MenuProduct, "imageUrl" | "imageIsIllustrative" | "name">; sizes: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-orange-100", className)}>
      {p.imageUrl && <Image src={p.imageUrl} alt={p.name} fill sizes={sizes} className="object-cover" />}
      {p.imageIsIllustrative && p.imageUrl && !p.imageUrl.endsWith(".svg") && (
        <span className="absolute bottom-2 left-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Illustrative photo</span>
      )}
    </div>
  );
}

export function ProductCard({ p, branchSelected, orderingBlocked }: { p: MenuProduct; branchSelected: boolean; orderingBlocked: string | null }) {
  const [open, setOpen] = useState(false);
  const hasOptions = p.groups.length > 0;
  const add = useCart((s) => s.add);
  const disabled = !p.available;

  function quickAdd() {
    if (!branchSelected) {
      window.dispatchEvent(new CustomEvent("ce:need-branch"));
      return;
    }
    if (hasOptions) return setOpen(true);
    add({ productId: p.id, name: p.name, imageUrl: p.imageUrl, optionIds: [], optionLabels: [], unitPriceKobo: p.basePriceKobo });
    window.dispatchEvent(new CustomEvent("ce:toast", { detail: `${p.name} added to cart` }));
  }

  return (
    <article className={cn("group flex flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-ink/5", disabled && "opacity-70")}>
      <button onClick={() => !disabled && (branchSelected ? setOpen(true) : quickAdd())} className="text-left" disabled={disabled} aria-label={`View ${p.name}`}>
        <ProductImage p={p} sizes="(max-width: 640px) 100vw, 33vw" className="aspect-[4/3]" />
      </button>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-2xl font-bold leading-tight">{p.name}</h3>
          {!p.available && <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">Unavailable</span>}
        </div>
        {p.description && <p className="mt-1 text-sm text-ink-3">{p.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-lg font-bold">
            {hasOptions && p.groups.some((g) => g.options.some((o) => o.priceDeltaKobo > 0)) && <span className="mr-1 text-xs font-semibold uppercase text-ink-3">From</span>}
            {formatNaira(fromPrice(p))}
          </span>
          <Button size="sm" variant={disabled ? "outline" : "red"} disabled={disabled || !!orderingBlocked} onClick={quickAdd} aria-label={`Add ${p.name}`}>
            {disabled ? "Sold out" : hasOptions ? "Choose" : <><Plus className="size-4" /> Add</>}
          </Button>
        </div>
      </div>
      {open && <ProductDialog p={p} onClose={() => setOpen(false)} blocked={orderingBlocked} />}
    </article>
  );
}

export function ProductDialog({ p, onClose, blocked }: { p: MenuProduct; onClose: () => void; blocked: string | null }) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(p.groups.map((g) => [g.id, g.required && g.options.length === 1 ? [g.options[0].id] : []])),
  );
  const missing = p.groups.filter((g) => (sel[g.id]?.length ?? 0) < Math.max(g.minSelect, g.required ? 1 : 0));
  const unit = p.basePriceKobo + p.groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id))).reduce((s, o) => s + o.priceDeltaKobo, 0);

  function toggle(gid: string, oid: string, max: number) {
    setSel((s) => {
      const cur = s[gid] ?? [];
      if (cur.includes(oid)) return { ...s, [gid]: cur.filter((x) => x !== oid) };
      if (max === 1) return { ...s, [gid]: [oid] };
      if (cur.length >= max) return s;
      return { ...s, [gid]: [...cur, oid] };
    });
  }

  function addToCart() {
    const chosen = p.groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id)));
    add({ productId: p.id, name: p.name, imageUrl: p.imageUrl, optionIds: chosen.map((o) => o.id), optionLabels: chosen.map((o) => o.name), unitPriceKobo: unit }, qty);
    window.dispatchEvent(new CustomEvent("ce:toast", { detail: `${p.name} added to cart` }));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={p.name} onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <ProductImage p={p} sizes="512px" className="aspect-[16/9]" />
          <button onClick={onClose} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/95 shadow" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <h2 className="font-display text-4xl font-bold leading-none">{p.name}</h2>
          {p.description && <p className="mt-2 text-ink-3">{p.description}</p>}
          {p.groups.map((g) => (
            <fieldset key={g.id} className="mt-6">
              <legend className="mb-2 flex w-full items-center justify-between">
                <span className="font-display text-xl font-bold uppercase tracking-wide">{g.name}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", g.required ? "bg-red-50 text-brand-red" : "bg-ink/5 text-ink-3")}>{g.required ? "Required" : "Optional"}</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.options.map((o) => {
                  const on = sel[g.id]?.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(g.id, o.id, g.maxSelect)}
                      aria-pressed={on}
                      className={cn("flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition-colors", on ? "border-brand-red bg-red-50" : "border-line hover:border-brand-orange")}
                    >
                      <span className="font-semibold">{o.name}</span>
                      <span className="flex items-center gap-2 text-sm text-ink-2">
                        {g.name === "Size" ? formatNaira(p.basePriceKobo + o.priceDeltaKobo) : o.priceDeltaKobo > 0 ? `+${formatNaira(o.priceDeltaKobo)}` : ""}
                        {on && <Check className="size-4 text-brand-red" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="border-t border-line p-4">
          {blocked && <p className="mb-2 text-sm font-semibold text-brand-red">{blocked}</p>}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-paper p-1">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-10 place-items-center rounded-full bg-white shadow-sm" aria-label="Decrease quantity"><Minus className="size-4" /></button>
              <span className="w-8 text-center font-bold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(50, q + 1))} className="grid size-10 place-items-center rounded-full bg-white shadow-sm" aria-label="Increase quantity"><Plus className="size-4" /></button>
            </div>
            <Button variant="red" size="lg" className="flex-1" disabled={missing.length > 0 || !p.available || !!blocked} onClick={addToCart}>
              {missing.length > 0 ? `Choose ${missing[0].name.toLowerCase()}` : `Add · ${formatNaira(unit * qty)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
