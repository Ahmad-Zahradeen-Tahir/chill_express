"use client";
import { useState, useTransition } from "react";
import { staffRecheckOrder, staffWithdrawModification } from "@/app/actions/staff-orders";
import { Button } from "@/components/ui/button";

export function OrderTools({ orderId, canWithdraw }: { orderId: string; canWithdraw: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.message ?? "Done.") : (r.error ?? "Failed"));
    });
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => staffRecheckOrder(orderId))}>Re-check with Paystack</Button>
      {canWithdraw && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => staffWithdrawModification(orderId))}>Withdraw modification</Button>}
      {msg && <p className="w-full text-xs font-semibold text-ink-2">{msg}</p>}
    </div>
  );
}
