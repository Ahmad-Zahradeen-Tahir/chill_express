import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { getStaff } from "@/server/auth/guard";
import { StaffLoginForm } from "./form";

export const metadata: Metadata = { title: "Staff sign in" };
export const dynamic = "force-dynamic";

export default async function StaffLogin() {
  if (await getStaff()) redirect("/staff");
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="dots hidden flex-col justify-between bg-brand-red p-10 text-white lg:flex">
        <Logo variant="white" className="h-12" />
        <div>
          <h1 className="font-display text-7xl font-extrabold uppercase leading-[0.9]">Management<br />portal</h1>
          <p className="mt-4 max-w-sm text-white/85">Order approvals, kitchen workflow, menu, branches and analytics for Gombole Road and Lagos Street.</p>
        </div>
        <p className="text-sm text-white/70">Authorised staff only. All actions are logged.</p>
      </div>
      <div className="flex items-center justify-center bg-paper p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo className="h-10" /></div>
          <h2 className="font-display text-5xl font-extrabold uppercase">Staff sign in</h2>
          <p className="mb-6 mt-1 text-sm text-ink-3">Use the account created for you by management.</p>
          <StaffLoginForm />
        </div>
      </div>
    </div>
  );
}
