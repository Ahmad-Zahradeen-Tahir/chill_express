import "server-only";
import { simStore } from "./sim-store";

export type VerifyResult = {
  status: "success" | "failed" | "abandoned" | "pending";
  amountKobo: number;
  currency: string;
  transactionId: string | null;
  channel: string | null;
  gatewayResponse: string | null;
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: "PAYSTACK" | "DEV_SIM";
  initialize(input: {
    reference: string;
    amountKobo: number;
    email: string;
    callbackUrl: string;
    metadata: Record<string, unknown>;
  }): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<VerifyResult>;
  webhookSecret(): string;
}

export class PaymentProviderError extends Error {}

// ---------------- Paystack (real) ----------------

const PAYSTACK_BASE = "https://api.paystack.co";

class PaystackProvider implements PaymentProvider {
  readonly name = "PAYSTACK" as const;
  constructor(private secret: string) {}

  private async call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(PAYSTACK_BASE + path, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${this.secret}`, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: unknown } | null;
    if (!res.ok || !json?.status) {
      throw new PaymentProviderError(json?.message || `Paystack request failed (${res.status})`);
    }
    return json.data as T;
  }

  async initialize(input: Parameters<PaymentProvider["initialize"]>[0]) {
    const data = await this.call<{ authorization_url: string }>("/transaction/initialize", {
      method: "POST",
      body: {
        email: input.email,
        amount: input.amountKobo,
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      },
    });
    return { authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const d = await this.call<{
      status: string;
      amount: number;
      currency: string;
      id: number;
      channel: string;
      gateway_response: string;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    const status: VerifyResult["status"] =
      d.status === "success" ? "success" : d.status === "failed" ? "failed" : d.status === "abandoned" ? "abandoned" : "pending";
    return {
      status,
      amountKobo: Number(d.amount),
      currency: d.currency,
      transactionId: d.id ? String(d.id) : null,
      channel: d.channel ?? null,
      gatewayResponse: d.gateway_response ?? null,
      raw: d,
    };
  }

  webhookSecret() {
    return this.secret;
  }
}

// ---------------- Dev simulator (clearly labelled, never real money) ----------------
// Outcomes are stored in-process and in the payment row (see services/payments.ts -> simulator pages).



class DevSimProvider implements PaymentProvider {
  readonly name = "DEV_SIM" as const;
  constructor(
    private secret: string,
    private appUrl: string,
  ) {}

  async initialize(input: Parameters<PaymentProvider["initialize"]>[0]) {
    simStore.createTxn(input.reference, input.amountKobo);
    return { authorizationUrl: `${this.appUrl}/simulated-payment/${encodeURIComponent(input.reference)}` };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const t = await simStore.getTxn(reference);
    if (!t) throw new PaymentProviderError("Unknown simulated transaction");
    return {
      status: t.outcome === "success" ? "success" : t.outcome === "failed" ? "failed" : "pending",
      amountKobo: t.amountKobo,
      currency: "NGN",
      transactionId: `SIM-${reference}`,
      channel: "simulated",
      gatewayResponse: t.outcome === "failed" ? "Declined (simulated)" : "Approved (simulated)",
      raw: { simulated: true, ...t },
    };
  }

  webhookSecret() {
    return this.secret;
  }
}

// ---------------- selection ----------------

export function paymentsDriver(): "paystack" | "dev-sim" {
  return process.env.PAYMENTS_DRIVER === "dev-sim" ? "dev-sim" : "paystack";
}

/** True when the site is running on simulated payments. The UI shows a permanent warning banner. */
export function isSimulatedPayments(): boolean {
  return paymentsDriver() === "dev-sim";
}

let cached: PaymentProvider | null = null;
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  if (paymentsDriver() === "dev-sim") {
    // Simulated payments must be explicitly allowed when running a production build (local demo).
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SIMULATED_PAYMENTS !== "true") {
      throw new PaymentProviderError("Simulated payments are disabled in production. Configure Paystack keys.");
    }
    const secret = process.env.DEV_SIM_SECRET;
    if (!secret) throw new PaymentProviderError("DEV_SIM_SECRET is not set");
    cached = new DevSimProvider(secret, appUrl);
  } else {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new PaymentProviderError("PAYSTACK_SECRET_KEY is not set");
    cached = new PaystackProvider(secret);
  }
  return cached;
}

export { signWebhook, verifyWebhookSignature } from "./signature";
