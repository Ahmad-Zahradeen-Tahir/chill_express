"use client";
import { useTransition } from "react";
import { simulateOutcome } from "@/app/actions/simulator";
import { Button } from "@/components/ui/button";

export function SimButtons({ reference, done }: { reference: string; done: boolean }) {
  const [pending, start] = useTransition();
  const go = (o: "success" | "failed") =>
    start(async () => {
      const r = await simulateOutcome(reference, o);
      window.location.href = r.redirect;
    });
  if (done) return <p className="mt-6 text-sm font-semibold">This simulated payment has already been completed.</p>;
  return (
    <div className="mt-6 grid gap-3">
      <Button variant="success" size="lg" disabled={pending} onClick={() => go("success")}>Simulate successful payment</Button>
      <Button variant="outline" size="lg" disabled={pending} onClick={() => go("failed")}>Simulate declined card</Button>
    </div>
  );
}
