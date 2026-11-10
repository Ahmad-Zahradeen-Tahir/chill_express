"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchProduct } from "@/server/db/schema";
import { AuthzError, getStaff } from "@/server/auth/guard";
import { canAccessBranch } from "@/server/auth/permissions";
import { audit } from "@/server/services/audit";

export async function setAvailability(productId: string, branchId: string, available: boolean) {
  const ctx = await getStaff();
  if (!ctx) throw new AuthzError("Sign in required", "UNAUTHENTICATED");
  if (!(ctx.permissions.has("menu.availability") || ctx.permissions.has("menu.manage")) || !canAccessBranch(ctx, branchId)) throw new AuthzError("Not allowed for this branch");
  await db.transaction(async (tx) => {
    await tx
      .insert(branchProduct)
      .values({ branchId, productId, available })
      .onConflictDoUpdate({ target: [branchProduct.branchId, branchProduct.productId], set: { available, updatedAt: new Date() } });
    await audit(tx, { actorUserId: ctx.userId, action: available ? "menu.available" : "menu.unavailable", entity: "product", entityId: productId, branchId });
  });
  revalidatePath("/", "layout");
}
