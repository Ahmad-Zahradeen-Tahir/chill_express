import Link from "next/link";
import { eq } from "drizzle-orm";
import { PortalShell } from "@/components/portal/shell";
import { requireStaffPage } from "@/server/auth/guard";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaffPage();
  const u = await db.query.user.findFirst({ where: eq(user.id, ctx.userId), columns: { mustChangePassword: true } });
  return (
    <PortalShell ctx={ctx}>
      {u?.mustChangePassword && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-100 px-4 py-3 text-sm">
          Your password was set by management. <Link href="/staff/password" className="font-semibold text-brand-red underline">Choose a new password</Link> before continuing.
        </div>
      )}
      {children}
    </PortalShell>
  );
}
