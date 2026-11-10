import { SiteHeader } from "@/components/customer/site-header";
import { SiteFooter } from "@/components/customer/site-footer";
import { SimulatedPaymentsBanner } from "@/components/customer/sim-banner";
import { getBranchesWithState, getSettings } from "@/server/services/site";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const [settings, branches] = await Promise.all([getSettings(), getBranchesWithState()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <SimulatedPaymentsBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} branches={branches} />
    </div>
  );
}
