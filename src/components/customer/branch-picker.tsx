"use client";
import { MapPin, ChevronDown, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { selectBranch } from "@/app/actions/branch";
import { useCart, useCartHydrated } from "@/lib/client/cart-store";
import { cn } from "@/lib/cn";

export type PickerBranch = { id: string; name: string; address: string | null; blockReason: string | null };

export function BranchPicker({ branches, selectedId, variant = "chip" }: { branches: PickerBranch[]; selectedId: string | null; variant?: "chip" | "big" }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const cart = useCart();
  const hydrated = useCartHydrated();
  const selected = branches.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    // Keep the cart's branch in sync with the cookie.
    if (hydrated && selectedId && cart.branchId !== selectedId && cart.items.length === 0) cart.setBranch(selectedId);
  }, [cart, hydrated, selectedId]);

  function choose(id: string) {
    if (cart.items.length > 0 && cart.branchId && cart.branchId !== id) {
      if (!confirm("Switching branch will empty your cart, because availability differs per branch. Continue?")) return;
      cart.clear();
    }
    cart.setBranch(id);
    start(async () => {
      await selectBranch(id);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {variant === "chip" ? (
        <button onClick={() => setOpen(true)} className="flex min-w-0 items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/10 hover:bg-white">
          <MapPin className="size-4 shrink-0 text-brand-red" aria-hidden />
          <span className="truncate">{selected ? selected.name : "Choose branch"}</span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 text-left shadow-card ring-1 ring-ink/5 hover:ring-brand-orange">
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-red-50"><MapPin className="size-5 text-brand-red" aria-hidden /></span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-wide text-ink-3">Ordering from</span>
              <span className="block font-display text-2xl font-bold leading-tight">{selected ? selected.name : "Choose a branch"}</span>
            </span>
          </span>
          <span className="text-sm font-semibold text-brand-red">{selected ? "Change" : "Select"}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Choose a branch" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-3xl font-bold">Choose your branch</h2>
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Close"><X className="size-5" /></button>
            </div>
            <p className="mb-4 text-sm text-ink-3">Both branches are in Maiduguri. Your order is prepared at the branch you pick.</p>
            <div className="space-y-3">
              {branches.map((b) => (
                <button
                  key={b.id}
                  disabled={pending}
                  onClick={() => choose(b.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border-2 px-4 py-4 text-left transition-colors",
                    b.id === selectedId ? "border-brand-red bg-red-50" : "border-line hover:border-brand-orange",
                  )}
                >
                  <span>
                    <span className="block font-display text-2xl font-bold">{b.name}</span>
                    <span className="block text-sm text-ink-3">{b.address || "Maiduguri"}</span>
                    {b.blockReason && <span className="mt-1 block text-xs font-semibold text-brand-red">{b.blockReason}</span>}
                  </span>
                  {b.id === selectedId && <Check className="size-6 text-brand-red" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
