"use client";
import { useOptimistic, useTransition } from "react";
import { setAvailability } from "@/app/actions/menu";
import { cn } from "@/lib/cn";

export function AvailabilityToggle({ productId, branchId, available }: { productId: string; branchId: string; available: boolean }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(available);
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => start(async () => { setOn(!on); await setAvailability(productId, branchId, !on); })}
      className={cn("inline-flex h-8 min-w-28 items-center justify-center rounded-full px-3 text-xs font-bold transition-colors", on ? "bg-success-50 text-success ring-1 ring-green-200" : "bg-red-50 text-brand-red ring-1 ring-red-100")}
    >
      {on ? "Available" : "Sold out"}
    </button>
  );
}
