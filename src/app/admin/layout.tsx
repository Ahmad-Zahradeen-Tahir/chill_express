import { PortalShell } from "@/components/portal/shell";
import { requireStaffPage } from "@/server/auth/guard";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaffPage();
  return <PortalShell ctx={ctx}>{children}</PortalShell>;
}
