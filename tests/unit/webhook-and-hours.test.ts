import { describe, expect, it } from "vitest";
import { signWebhook, verifyWebhookSignature } from "@/server/paystack/signature";
import { isWithinHours, orderingBlockReason } from "@/server/services/branch-hours";
import { formatNaira } from "@/lib/money";

describe("webhook signature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "CEP_1" } });
  it("accepts a valid HMAC-SHA512 signature", () => {
    expect(verifyWebhookSignature(body, signWebhook(body, "sk_test_x"), "sk_test_x")).toBe(true);
  });
  it("rejects tampered body, wrong secret and missing header", () => {
    const sig = signWebhook(body, "sk_test_x");
    expect(verifyWebhookSignature(body.replace("CEP_1", "CEP_2"), sig, "sk_test_x")).toBe(false);
    expect(verifyWebhookSignature(body, sig, "sk_test_y")).toBe(false);
    expect(verifyWebhookSignature(body, null, "sk_test_x")).toBe(false);
    expect(verifyWebhookSignature(body, "short", "sk_test_x")).toBe(false);
  });
});

describe("branch hours (Africa/Lagos)", () => {
  const hours = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, opens: "10:00", closes: "22:00", closed: false }));
  it("open inside hours, closed outside", () => {
    expect(isWithinHours(hours, new Date("2026-11-09T12:00:00Z"))).toBe(true); // 13:00 Lagos
    expect(isWithinHours(hours, new Date("2026-11-09T21:30:00Z"))).toBe(false); // 22:30 Lagos
  });
  it("temporary closure blocks ordering regardless of hours", () => {
    expect(orderingBlockReason({ isOpen: false, acceptingOrders: true, enforceHours: false, closedMessage: null }, hours)).toMatch(/closed/);
    expect(orderingBlockReason({ isOpen: true, acceptingOrders: true, enforceHours: false, closedMessage: null }, [])).toBeNull();
  });
});

describe("naira formatting", () => {
  it("formats kobo as naira", () => {
    expect(formatNaira(850000)).toBe("₦8,500");
    expect(formatNaira(150050)).toBe("₦1,500.50");
  });
});
