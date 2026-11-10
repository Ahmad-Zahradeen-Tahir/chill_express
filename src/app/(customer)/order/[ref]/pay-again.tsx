"use client";
import { useState, useTransition } from "react";
import { payAgain } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";

export function PayAgainButton({ reference, amount }: { reference: string; amount: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-4">
      <Button
        variant="red"
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await payAgain(reference);
            if (r.ok) window.location.href = r.redirectUrl;
            else setErr(r.error);
          })
        }
      >
        {pending ? "Starting payment…" : `Pay ${amount} with Paystack`}
      </Button>
      {err && <p className="mt-2 text-sm font-semibold text-brand-red">{err}</p>}
    </div>
  );
}
