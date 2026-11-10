import Link from "next/link";
import { cn } from "@/lib/cn";

export function BranchTabs({ branches, current, base, extra = "" }: { branches: { id: string; name: string }[]; current: string | null; base: string; extra?: string }) {
  if (branches.length < 2) return null;
  const href = (id: string | null) => `${base}?${new URLSearchParams({ ...(id ? { b: id } : {}), ...Object.fromEntries(new URLSearchParams(extra)) }).toString()}`;
  return (
    <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
      {[{ id: null as string | null, name: "All branches" }, ...branches].map((b) => (
        <Link key={b.id ?? "all"} href={href(b.id)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", current === b.id ? "bg-ink text-white" : "text-ink-2 hover:bg-ink/5")}>
          {b.name}
        </Link>
      ))}
    </div>
  );
}
