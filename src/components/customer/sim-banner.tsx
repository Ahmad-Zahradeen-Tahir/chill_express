import { isSimulatedPayments } from "@/server/paystack/provider";

/** Permanent, unmissable warning whenever the payment simulator is active. */
export function SimulatedPaymentsBanner() {
  if (!isSimulatedPayments()) return null;
  return (
    <div className="bg-ink px-4 py-2 text-center text-xs font-semibold text-brand-orange">
      DEMO MODE — payments are SIMULATED, no real money moves. Paystack test keys have not been configured yet.
    </div>
  );
}
