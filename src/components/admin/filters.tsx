"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

const RANGES = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["custom", "Custom"],
] as const;

export function AnalyticsFilters({ branches, showDemoToggle }: { branches: { id: string; name: string }[]; showDemoToggle: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const r = sp.get("r") ?? "7d";
  const b = sp.get("b") ?? "";
  const demo = sp.get("demo") !== "0";
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const go = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.push(`${path}?${q.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="no-scrollbar flex overflow-x-auto rounded-full bg-white p-1 ring-1 ring-line">
        {RANGES.map(([k, l]) => (
          <button key={k} onClick={() => (k === "custom" ? go({ r: "custom" }) : go({ r: k, from: null, to: null }))} className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold", r === k ? "bg-ink text-white" : "text-ink-2 hover:bg-ink/5")}>
            {l}
          </button>
        ))}
      </div>
      {r === "custom" && (
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" aria-label="From" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" aria-label="To" />
          <Button size="sm" variant="dark" onClick={() => go({ from, to })} disabled={!from || !to}>Apply</Button>
        </div>
      )}
      {branches.length > 1 && (
        <div className="flex rounded-full bg-white p-1 ring-1 ring-line">
          {[{ id: "", name: "All branches" }, ...branches].map((x) => (
            <button key={x.id} onClick={() => go({ b: x.id || null })} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", b === x.id ? "bg-brand-red text-white" : "text-ink-2 hover:bg-ink/5")}>
              {x.name}
            </button>
          ))}
        </div>
      )}
      {showDemoToggle && (
        <label className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-line">
          <input type="checkbox" checked={demo} onChange={(e) => go({ demo: e.target.checked ? null : "0" })} className="size-4 accent-brand-red" />
          Include demo data
        </label>
      )}
    </div>
  );
}
