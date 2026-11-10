import { describe, expect, it } from "vitest";
import { availableActions, canTransition } from "@/server/services/order-state";

describe("order state machine", () => {
  it("never lets an unpaid order reach preparation", () => {
    expect(canTransition("AWAITING_PAYMENT", "CONFIRMED")).toBe(false);
    expect(canTransition("AWAITING_PAYMENT", "PREPARING")).toBe(false);
    expect(canTransition("PAYMENT_FAILED", "CONFIRMED")).toBe(false);
  });
  it("paid orders must be approved before preparing", () => {
    expect(canTransition("PENDING_APPROVAL", "PREPARING")).toBe(false);
    expect(canTransition("PENDING_APPROVAL", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PREPARING")).toBe(true);
  });
  it("pickup vs delivery end states", () => {
    expect(canTransition("PREPARING", "READY_FOR_PICKUP", "PICKUP")).toBe(true);
    expect(canTransition("PREPARING", "READY_FOR_PICKUP", "DELIVERY")).toBe(false);
    expect(canTransition("PREPARING", "OUT_FOR_DELIVERY", "PICKUP")).toBe(false);
    expect(availableActions("PREPARING", "PICKUP")).toContain("mark_ready");
    expect(availableActions("PREPARING", "PICKUP")).not.toContain("out_for_delivery");
  });
  it("terminal states are final", () => {
    for (const s of ["COMPLETED", "REJECTED", "CANCELLED"] as const) {
      expect(availableActions(s, "PICKUP")).toEqual([]);
    }
  });
  it("only pending orders can be approved/rejected", () => {
    expect(availableActions("PENDING_APPROVAL", "PICKUP").sort()).toEqual(["approve", "reject"]);
    expect(availableActions("CONFIRMED", "PICKUP")).not.toContain("approve");
  });
});
