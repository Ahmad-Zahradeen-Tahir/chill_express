import type { Metadata } from "next";
import { TrackForm } from "./track-form";
import { Alert } from "@/components/ui/form";

export const metadata: Metadata = { title: "Track your order" };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ ref?: string; e?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-6xl font-extrabold uppercase leading-none">Track order</h1>
      <p className="mt-2 text-ink-3">Enter the order reference (e.g. CE-GR-7K3Q9P) and the phone number you used at checkout.</p>
      {sp.e === "verify" && <Alert tone="error" className="mt-4">We couldn’t confirm your payment with Paystack just now. If you were charged, your order will update automatically within a few minutes.</Alert>}
      <TrackForm initialRef={sp.ref ?? ""} />
    </div>
  );
}
