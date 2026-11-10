"use client";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MenuCategory } from "@/server/services/catalog";
import { cn } from "@/lib/cn";
import { ProductCard } from "./product-card";
import { Alert } from "@/components/ui/form";

export function MenuBrowser({ menu, branchSelected, orderingBlocked, initialCategory }: { menu: MenuCategory[]; branchSelected: boolean; orderingBlocked: string | null; initialCategory?: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(initialCategory && menu.some((c) => c.slug === initialCategory) ? initialCategory : "all");
  const [needBranch, setNeedBranch] = useState(false);

  useEffect(() => {
    const h = () => setNeedBranch(true);
    window.addEventListener("ce:need-branch", h);
    return () => window.removeEventListener("ce:need-branch", h);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return menu
      .filter((c) => cat === "all" || c.slug === cat)
      .map((c) => ({
        ...c,
        products: c.products.filter((p) => !term || p.name.toLowerCase().includes(term) || c.name.toLowerCase().includes(term) || p.groups.some((g) => g.options.some((o) => o.name.toLowerCase().includes(term)))),
      }))
      .filter((c) => c.products.length > 0);
  }, [menu, q, cat]);

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search shawarma, fries, drinks…"
            className="h-12 w-full rounded-full border border-line bg-white pl-12 pr-10 text-[15px] focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-brand-orange/20"
            aria-label="Search the menu"
          />
          {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-ink/5" aria-label="Clear search"><X className="size-4" /></button>}
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {[{ slug: "all", name: "All" }, ...menu].map((c) => (
            <button
              key={c.slug}
              onClick={() => setCat(c.slug)}
              className={cn("h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors", cat === c.slug ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line hover:ring-ink/30")}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {(needBranch || !branchSelected) && (
        <Alert tone="warn" className="mt-4">
          <strong>Choose a branch first</strong> — tap the branch button at the top to pick Gombole Road or Lagos Street.
        </Alert>
      )}
      {orderingBlocked && branchSelected && <Alert tone="error" className="mt-4">{orderingBlocked}</Alert>}

      {filtered.length === 0 && <p className="py-16 text-center text-ink-3">No items match “{q}”.</p>}
      {filtered.map((c) => (
        <section key={c.id} className="pt-8" id={c.slug}>
          <h2 className="font-display text-4xl font-extrabold uppercase">{c.name}</h2>
          {c.description && <p className="text-ink-3">{c.description}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.products.map((p) => (
              <ProductCard key={p.id} p={p} branchSelected={branchSelected} orderingBlocked={orderingBlocked} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
