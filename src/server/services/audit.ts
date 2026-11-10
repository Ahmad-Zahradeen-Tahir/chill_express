import "server-only";
import type { DbOrTx } from "@/server/db";
import { auditLog } from "@/server/db/schema";

export async function audit(
  tx: DbOrTx,
  e: {
    actorUserId?: string | null;
    actorLabel?: string;
    action: string;
    entity: string;
    entityId?: string | null;
    branchId?: string | null;
    data?: unknown;
    ip?: string | null;
  },
) {
  await tx.insert(auditLog).values({
    actorUserId: e.actorUserId ?? null,
    actorLabel: e.actorLabel ?? (e.actorUserId ? null : "system"),
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? null,
    branchId: e.branchId ?? null,
    data: (e.data ?? null) as never,
    ip: e.ip ?? null,
  });
}
