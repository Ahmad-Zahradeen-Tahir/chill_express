"use client";
import { MapPin, ChevronDown, X, Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { selectBranch } from "@/app/actions/branch";
import { useCart, useCartHydrated } from "@/lib/client/cart-store";
import { cn } from "@/lib/cn";

export type PickerBranch = { id: string; name: string; address: string | null; blockReason: string | null };

// Pages where a customer is following up on an order, not starting one: no automatic prompt there.
const NO_PROMPT = ["/track", "/order", "/login", "/register", "/account"];
const DISMISSED_KEY = "ce_branch_prompt_dismissed";
const noSubscribe = () => () => {};
function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Branch chooser. With `prompt`, it opens by itself when no branch is chosen yet (once per visit unless
 * the customer picks one), and whenever an "Add" button needs a branch first.
 */
export function BranchPicker({ branches, selectedId, variant = "chip", prompt = false }: { branches: PickerBranch[]; selectedId: string | null; variant?: "chip" | "big"; prompt?: boolean }) {
  const [open, setOpen] = useState(false);
  const [dismissedNow, setDismissedNow] = useState(false);
  // The server renders as "dismissed" so the prompt only appears after hydration.
  const dismissedEarlier = useSyncExternalStore(noSubscribe, readDismissed, () => true);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const cart = useCart();
  const hydrated = useCartHydrated();
  const selected = branches.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    // Keep the cart's branch in sync with the cookie.
    if (hydrated && selectedId && cart.branchId !== selectedId && cart.items.length === 0) cart.setBranch(selectedId);
  }, [cart, hydrated, selectedId]);

  const welcome = prompt && !selectedId && !dismissedEarlier && !dismissedNow && !NO_PROMPT.some((p) => pathname.startsWith(p));
  const isOpen = open || welcome;

  useEffect(() => {
    if (!prompt) return;
    const h = () => setOpen(true);
    window.addEventListener("ce:need-branch", h);
    return () => window.removeEventListener("ce:need-branch", h);
  }, [prompt]);

  function close() {
    setOpen(false);
    if (welcome) {
      setDismissedNow(true);
      try {
        sessionStorage.setItem(DISMISSED_KEY, "1");
      } catch {}
    }
  }

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

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Choose a branch" onClick={close} onKeyDown={(e) => e.key === "Escape" && close()}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                {welcome && <p className="text-xs font-bold uppercase tracking-wide text-brand-red">Welcome to Chill. Express</p>}
                <h2 className="font-display text-3xl font-bold leading-tight">{welcome ? "Where are you ordering from?" : "Choose your branch"}</h2>
              </div>
              <button onClick={close} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-ink/5" aria-label="Close"><X className="size-5" /></button>
            </div>
            <p className="mb-4 text-sm text-ink-3">Both branches are in Maiduguri. Pick one to see its menu and what&apos;s in stock. You can change it any time from the top of the page.</p>
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
