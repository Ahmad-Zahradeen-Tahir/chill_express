"use client";
import { useState, useTransition } from "react";
import { staffOrderAction } from "@/app/actions/staff-orders";
import type { StaffAction } from "@/server/services/order-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const LABEL: Record<StaffAction, string> = {
  approve: "Approve",
  start_preparing: "Start preparing",
  mark_ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  complete: "Complete",
};
const VARIANT: Record<StaffAction, "success" | "outline" | "red" | "dark" | "primary"> = {
  approve: "success",
  start_preparing: "dark",
  mark_ready: "primary",
  out_for_delivery: "primary",
  complete: "dark",
};

export function OrderActions({ orderId, actions, size = "sm", className }: { orderId: string; actions: StaffAction[]; size?: "sm" | "md"; className?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(a: StaffAction) {
    setErr(null);
    start(async () => {
      const r = await staffOrderAction(orderId, a);
      if (!r.ok) setErr(r.error);
    });
  }

  if (!actions.length) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a} size={size} variant={VARIANT[a]} disabled={pending} className={cn(a === "approve" && "flex-1")} onClick={() => run(a)}>
            {LABEL[a]}
          </Button>
        ))}
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-brand-red">{err}</p>}
    </div>
  );
}
