import { asc } from "drizzle-orm";
import { db } from "@/server/db";
import { branch, branchHours } from "@/server/db/schema";
import { requireStaffPage } from "@/server/auth/guard";
import { canAccessBranch } from "@/server/auth/permissions";
import { saveBranch, saveBusinessSettings, saveHours } from "@/app/actions/branch-admin";
import { getSettings } from "@/server/services/site";
import { DAY_NAMES, orderingBlockReason } from "@/server/services/branch-hours";
import { ActionForm, Check } from "@/components/admin/forms";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

export default async function BranchesAdmin() {
  const ctx = await requireStaffPage("branches.manage");
  const [branches, hours, settings] = await Promise.all([db.select().from(branch).orderBy(asc(branch.name)), db.select().from(branchHours), getSettings()]);
  const mine = branches.filter((b) => canAccessBranch(ctx, b.id));
  return (
    <div>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Branches</h1>
      <p className="text-sm text-ink-3">Both branches run on one platform. Addresses and hours are left blank until confirmed by the business.</p>

      {ctx.branchIds === null && (
        <Card className="mt-6 p-5">
          <h2 className="font-display text-2xl font-bold uppercase">Business contact</h2>
          <ActionForm action={saveBusinessSettings} className="mt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Phone (shown on website)"><Input name="phone" defaultValue={settings.phone} /></Field>
              <Field label="Instagram handle"><Input name="instagram" defaultValue={settings.instagram} /></Field>
              <Field label="Email (optional)"><Input name="email" type="email" defaultValue={settings.email ?? ""} /></Field>
            </div>
          </ActionForm>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {mine.map((b) => {
          const h = hours.filter((x) => x.branchId === b.id);
          const block = orderingBlockReason(b, h);
          return (
            <Card key={b.id} className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-3xl font-bold uppercase">{b.name}</h2>
                <Badge tone={block ? "red" : "green"}>{block ? "Not taking orders" : "Taking orders"}</Badge>
              </div>
              {block && <p className="mt-1 text-sm text-brand-red">{block}</p>}
              <ActionForm action={saveBranch.bind(null, b.id)} className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name"><Input name="name" defaultValue={b.name} /></Field>
                  <Field label="Branch phone"><Input name="phone" defaultValue={b.phone ?? ""} placeholder="Not set" /></Field>
                  <Field label="Address" className="sm:col-span-2"><Input name="address" defaultValue={b.address ?? ""} placeholder="Not set — add the confirmed address" /></Field>
                  <Field label="Delivery fee (₦)"><Input name="deliveryFee" type="number" step="50" min="0" defaultValue={b.deliveryFeeKobo / 100} /></Field>
                  <Field label="Typical prep time (minutes)"><Input name="prepTimeMins" type="number" min="1" defaultValue={b.prepTimeMins} /></Field>
                  <Field label="Message when closed" className="sm:col-span-2"><Input name="closedMessage" defaultValue={b.closedMessage ?? ""} placeholder="e.g. Closed today for maintenance" /></Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-paper p-3">
                  <Check name="isOpen" label="Branch open (untick = temporarily closed)" defaultChecked={b.isOpen} />
                  <Check name="acceptingOrders" label="Accepting online orders" defaultChecked={b.acceptingOrders} />
                  <Check name="pickupEnabled" label="Pickup" defaultChecked={b.pickupEnabled} />
                  <Check name="deliveryEnabled" label="Delivery" defaultChecked={b.deliveryEnabled} />
                  <Check name="enforceHours" label="Only accept orders during opening hours" defaultChecked={b.enforceHours} />
                </div>
              </ActionForm>
              <details className="mt-4 rounded-xl border border-line p-3">
                <summary className="cursor-pointer font-semibold">Opening hours {h.some((x) => x.opens) ? "" : "(not set)"}</summary>
                <ActionForm action={saveHours.bind(null, b.id)} className="mt-3" submitLabel="Save hours">
                  <div className="space-y-2">
                    {DAY_NAMES.map((d, i) => {
                      const row = h.find((x) => x.dayOfWeek === i);
                      return (
                        <div key={d} className="grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2 text-sm">
                          <span className="font-semibold">{d}</span>
                          <Input name={`opens_${i}`} type="time" defaultValue={row?.opens ?? ""} aria-label={`${d} opens`} />
                          <Input name={`closes_${i}`} type="time" defaultValue={row?.closes ?? ""} aria-label={`${d} closes`} />
                          <Check name={`closed_${i}`} label="Closed" defaultChecked={row?.closed} />
                        </div>
                      );
                    })}
                  </div>
                </ActionForm>
              </details>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
