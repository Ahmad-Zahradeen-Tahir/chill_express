import "server-only";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { branch, branchHours, siteSetting } from "@/server/db/schema";
import { orderingBlockReason } from "./branch-hours";

export async function getSettings() {
  const rows = await db.select().from(siteSetting);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const phone = map["business.phone"] || "+234 7052764227";
  const instagram = map["business.instagram"] || "@chill._express.ng";
  return {
    phone,
    phoneHref: "tel:" + phone.replace(/[^\d+]/g, ""),
    instagram,
    instagramUrl: `https://www.instagram.com/${instagram.replace(/^@/, "")}/`,
    email: map["business.email"] || null,
  };
}
export type SiteSettings = Awaited<ReturnType<typeof getSettings>>;

export async function getBranchesWithState() {
  const [bs, hrs] = await Promise.all([db.select().from(branch).orderBy(asc(branch.name)), db.select().from(branchHours)]);
  return bs.map((b) => {
    const hours = hrs.filter((h) => h.branchId === b.id).sort((a, c) => a.dayOfWeek - c.dayOfWeek);
    return { ...b, hours, blockReason: orderingBlockReason(b, hours) };
  });
}
export type BranchWithState = Awaited<ReturnType<typeof getBranchesWithState>>[number];

export async function getSelectedBranchId(): Promise<string | null> {
  const v = (await cookies()).get("ce_branch")?.value;
  if (!v || !/^[0-9a-f-]{36}$/i.test(v)) return null;
  const b = await db.query.branch.findFirst({ where: eq(branch.id, v), columns: { id: true } });
  return b?.id ?? null;
}
