import Link from "next/link";
import { User } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { getCurrentUser } from "@/server/auth/guard";
import { getBranchesWithState, getSelectedBranchId } from "@/server/services/site";
import { BranchPicker } from "./branch-picker";
import { CartButton } from "./cart-drawer";

export async function SiteHeader() {
  const [branches, selectedId, user] = await Promise.all([getBranchesWithState(), getSelectedBranchId(), getCurrentUser()]);
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-brand-orange">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="shrink-0" aria-label="Chill. Express home">
          <Logo variant="on-brand" className="h-8 sm:h-10" priority />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <Link href="/menu" className="rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-white/40">Menu</Link>
          <Link href="/track" className="rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-white/40">Track order</Link>
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="min-w-0 max-w-[46vw] sm:max-w-none">
            <BranchPicker branches={branches.map((b) => ({ id: b.id, name: b.name, address: b.address, blockReason: b.blockReason }))} selectedId={selectedId} />
          </div>
          <Link href={user && user.role === "CUSTOMER" ? "/account" : "/login"} className="hidden size-10 place-items-center rounded-full bg-white/90 text-ink ring-1 ring-ink/10 hover:bg-white sm:grid" aria-label={user ? "My account" : "Sign in"}>
            <User className="size-5" />
          </Link>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
