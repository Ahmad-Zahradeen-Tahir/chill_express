import type { Metadata } from "next";
import { getMenu } from "@/server/services/catalog";
import { getBranchesWithState, getSelectedBranchId } from "@/server/services/site";
import { MenuBrowser } from "@/components/customer/menu-browser";
import { Toaster } from "@/components/customer/toaster";

export const metadata: Metadata = { title: "Menu" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [{ c }, branchId, branches] = await Promise.all([searchParams, getSelectedBranchId(), getBranchesWithState()]);
  const menu = await getMenu(branchId);
  const branch = branches.find((b) => b.id === branchId) ?? null;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="pt-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-red">{branch ? `Ordering from ${branch.name}` : "Maiduguri"}</p>
        <h1 className="font-display text-6xl font-extrabold uppercase leading-none sm:text-7xl">The Menu</h1>
      </div>
      <MenuBrowser menu={menu} branchSelected={!!branch} orderingBlocked={branch?.blockReason ?? null} initialCategory={c} />
      <Toaster />
    </div>
  );
}
