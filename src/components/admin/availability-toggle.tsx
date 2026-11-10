"use client";
import { useOptimistic, useTransition } from "react";
import { setAvailability } from "@/app/actions/menu";
import { cn } from "@/lib/cn";

/** Per-branch "Available / Sold out" switch. Customers at that branch see the change immediately. */
export function AvailabilityToggle({
  productId,
  branchId,
  branchName,
  available,
}: {
  productId: string;
  branchId: string;
  branchName: string;
  available: boolean;
}) {
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(available);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${branchName} availability`}
      disabled={pending}
      title={
        on
          ? `Available at ${branchName}. Click to mark sold out.`
          : `Sold out at ${branchName}. Click to mark available.`
      }
      onClick={() =>
        start(async () => {
          setOn(!on);
          await setAvailability(productId, branchId, !on);
        })
      }
      className={cn(
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors disabled:opacity-60",
        on
          ? "bg-success-50 text-success ring-1 ring-green-200 hover:ring-green-400"
          : "bg-red-50 text-brand-red ring-1 ring-red-100 hover:ring-red-300",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          on ? "bg-success" : "bg-brand-red",
        )}
      />
      <span className="text-ink-2">{branchName}</span>
      <span>{on ? "Available" : "Sold out"}</span>
    </button>
  );
}
