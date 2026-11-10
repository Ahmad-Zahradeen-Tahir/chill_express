"use client";
import { useState, useTransition } from "react";
import { staffOrderAction } from "@/app/actions/staff-orders";
import type { StaffAction } from "@/server/services/order-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";

const LABEL: Record<StaffAction, string> = {
  approve: "Approve",
  reject: "Reject",
  start_preparing: "Start preparing",
  mark_ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  complete: "Complete",
  cancel: "Cancel",
};
const VARIANT: Record<StaffAction, "success" | "outline" | "red" | "dark" | "primary"> = {
  approve: "success",
  reject: "outline",
  start_preparing: "dark",
  mark_ready: "primary",
  out_for_delivery: "primary",
  complete: "dark",
  cancel: "outline",
};
const REJECT_REASONS = ["Item out of stock", "Branch too busy", "Outside delivery area", "Duplicate order", "Customer request"];

export function OrderActions({ orderId, actions, size = "sm", className }: { orderId: string; actions: StaffAction[]; size?: "sm" | "md"; className?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ask, setAsk] = useState<StaffAction | null>(null);
  const [note, setNote] = useState("");

  function run(a: StaffAction, n?: string) {
    setErr(null);
    start(async () => {
      const r = await staffOrderAction(orderId, a, n);
      if (!r.ok) setErr(r.error);
      else {
        setAsk(null);
        setNote("");
      }
    });
  }

  if (!actions.length) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a}
            size={size}
            variant={VARIANT[a]}
            disabled={pending}
            className={cn(a === "approve" && "flex-1")}
            onClick={() => (a === "reject" || a === "cancel" ? setAsk(a) : run(a))}
          >
            {LABEL[a]}
          </Button>
        ))}
      </div>
      {ask && (
        <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-900">{ask === "reject" ? "Reject order" : "Cancel order"} — a full refund will be started automatically.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setNote(r)} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-red-100 hover:ring-brand-red">{r}</button>
            ))}
          </div>
          <Textarea className="mt-2 bg-white" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (shown to the customer)" />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="red" disabled={pending || note.trim().length < 3} onClick={() => run(ask, note)}>{pending ? "Working…" : `Confirm ${ask}`}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAsk(null)}>Back</Button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs font-semibold text-brand-red">{err}</p>}
    </div>
  );
}
