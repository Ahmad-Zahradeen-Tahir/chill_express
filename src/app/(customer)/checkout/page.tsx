import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { savedAddress } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/guard";
import { getBranchesWithState, getSelectedBranchId } from "@/server/services/site";
import { CheckoutForm } from "@/components/customer/checkout-form";
import { isSimulatedPayments } from "@/server/paystack/provider";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [branchId, branches, user] = await Promise.all([getSelectedBranchId(), getBranchesWithState(), getCurrentUser()]);
  const branch = branches.find((b) => b.id === branchId) ?? null;
  const customer = user?.role === "CUSTOMER" ? user : null;
  const addresses = customer ? await db.select().from(savedAddress).where(eq(savedAddress.userId, customer.id)) : [];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-6xl font-extrabold uppercase leading-none">Checkout</h1>
      <CheckoutForm
        branch={branch && { id: branch.id, name: branch.name, deliveryFeeKobo: branch.deliveryFeeKobo, pickupEnabled: branch.pickupEnabled, deliveryEnabled: branch.deliveryEnabled, blockReason: branch.blockReason, prepTimeMins: branch.prepTimeMins }}
        customer={customer && { name: customer.name, email: customer.email, phone: customer.phone }}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, address: a.address, landmark: a.landmark, instructions: a.instructions }))}
        simulated={isSimulatedPayments()}
      />
    </div>
  );
}
