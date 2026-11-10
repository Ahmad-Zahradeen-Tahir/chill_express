"use client";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCount, cartSubtotal, useCart, useCartHydrated } from "@/lib/client/cart-store";
import { formatNaira } from "@/lib/money";
import { buttonClass } from "@/components/ui/button";

export function CartButton() {
  const items = useCart((s) => s.items);
  const hydrated = useCartHydrated();
  const [open, setOpen] = useState(false);
  const count = hydrated ? cartCount(items) : 0;

  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("ce:open-cart", h);
    return () => window.removeEventListener("ce:open-cart", h);
  }, []);

  return (
    <>
      <button onClick={() => setOpen(true)} className="relative flex h-10 items-center gap-2 rounded-full bg-brand-red px-4 text-sm font-semibold text-white hover:bg-red-700" aria-label={`Cart, ${count} items`}>
        <ShoppingBag className="size-5" aria-hidden />
        <span className="hidden sm:inline">Cart</span>
        {count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-brand-orange px-1 text-xs font-bold text-ink">{count}</span>}
      </button>
      {open && <CartDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, setQty, remove } = useCart();
  const subtotal = cartSubtotal(items);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/50" role="dialog" aria-modal="true" aria-label="Your cart" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-paper" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <h2 className="font-display text-3xl font-bold">Your order</h2>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Close cart"><X className="size-5" /></button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <ShoppingBag className="size-12 text-ink-3" aria-hidden />
            <p className="font-display text-2xl font-bold">Your cart is empty</p>
            <Link href="/menu" onClick={onClose} className={buttonClass("primary")}>Browse the menu</Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto p-4">
              {items.map((i) => (
                <li key={i.key} className="flex gap-3 rounded-2xl bg-white p-3 shadow-card">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-orange-100">
                    {i.imageUrl && <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold leading-tight">{i.name}</p>
                      <button onClick={() => remove(i.key)} className="text-ink-3 hover:text-brand-red" aria-label={`Remove ${i.name}`}><Trash2 className="size-4" /></button>
                    </div>
                    {i.optionLabels.length > 0 && <p className="text-xs text-ink-3">{i.optionLabels.join(" · ")}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-full bg-paper p-1">
                        <button onClick={() => setQty(i.key, i.quantity - 1)} className="grid size-7 place-items-center rounded-full bg-white shadow-sm" aria-label="Decrease quantity"><Minus className="size-3.5" /></button>
                        <span className="w-6 text-center text-sm font-bold">{i.quantity}</span>
                        <button onClick={() => setQty(i.key, i.quantity + 1)} className="grid size-7 place-items-center rounded-full bg-white shadow-sm" aria-label="Increase quantity"><Plus className="size-3.5" /></button>
                      </div>
                      <span className="font-semibold">{formatNaira(i.unitPriceKobo * i.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line bg-white p-5">
              <div className="mb-1 flex justify-between text-sm text-ink-2"><span>Subtotal</span><span className="font-semibold text-ink">{formatNaira(subtotal)}</span></div>
              <p className="mb-4 text-xs text-ink-3">Delivery fee (if any) is added at checkout. Prices are confirmed by our server before payment.</p>
              <Link href="/checkout" onClick={onClose} className={buttonClass("red", "lg", "w-full")}>Checkout · {formatNaira(subtotal)}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
