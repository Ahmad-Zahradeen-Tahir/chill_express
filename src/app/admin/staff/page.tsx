import { asc, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { branch, staffBranch, user, userPermissionOverride } from "@/server/db/schema";
import { requireStaffPage } from "@/server/auth/guard";
import { ALL_BRANCH_ROLES, PERMISSIONS, ROLE_LABELS, resolvePermissions, type StaffRole } from "@/server/auth/permissions";
import { createStaff } from "@/app/actions/staff-admin";
import { Badge, Card } from "@/components/ui/card";
import { ActionForm } from "@/components/admin/forms";
import { StaffFields, StaffRowActions } from "./client";

export default async function StaffAdmin() {
  const ctx = await requireStaffPage("staff.manage");
  const [people, branches, links, overrides] = await Promise.all([
    db.select().from(user).where(ne(user.role, "CUSTOMER")).orderBy(asc(user.role), asc(user.name)),
    db.select({ id: branch.id, name: branch.name }).from(branch).orderBy(asc(branch.name)),
    db.select().from(staffBranch),
    db.select().from(userPermissionOverride),
  ]);
  const roles: StaffRole[] = ctx.role === "CEO" ? ["CASHIER", "BRANCH_MANAGER", "CENTRAL_MANAGER", "CEO"] : ["CASHIER", "BRANCH_MANAGER", "CENTRAL_MANAGER"];
  return (
    <div>
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Staff</h1>
      <p className="text-sm text-ink-3">Every staff member has their own account. Cashiers and branch managers only see their assigned branches; this is enforced on the server.</p>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {people.map((p) => {
            const role = p.role as StaffRole;
            const bIds = links.filter((l) => l.userId === p.id).map((l) => l.branchId);
            const ov = overrides.filter((o) => o.userId === p.id);
            const effective = [...resolvePermissions(role, ov)];
            return (
              <Card key={p.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.name} {p.isDemo && <Badge>demo</Badge>} {p.status === "SUSPENDED" && <Badge tone="red">suspended</Badge>} {p.mustChangePassword && <Badge tone="orange">temp password</Badge>}</p>
                    <p className="text-sm text-ink-3">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                    <p className="mt-1 text-sm"><Badge tone="dark">{ROLE_LABELS[role]}</Badge> <span className="text-ink-3">{ALL_BRANCH_ROLES.includes(role) ? "All branches" : bIds.map((id) => branches.find((b) => b.id === id)?.name).join(", ") || "No branch"}</span>{ov.length > 0 && <Badge tone="orange" className="ml-1">{ov.length} custom permission{ov.length > 1 ? "s" : ""}</Badge>}</p>
                  </div>
                </div>
                <StaffRowActions
                  person={{ id: p.id, name: p.name, email: p.email, phone: p.phone ?? "", role, status: p.status, branchIds: bIds, self: p.id === ctx.userId }}
                  branches={branches}
                  roles={roles}
                  effective={effective}
                  permissions={Object.entries(PERMISSIONS).map(([k, v]) => ({ key: k, label: v }))}
                  editable={!(role === "CEO" && ctx.role !== "CEO")}
                />
              </Card>
            );
          })}
        </div>
        <aside>
          <Card className="p-5">
            <h2 className="font-display text-2xl font-bold uppercase">Add staff member</h2>
            <p className="text-sm text-ink-3">A one-time temporary password is generated. They must change it after first sign-in.</p>
            <ActionForm action={createStaff} submitLabel="Create account" variant="red" className="mt-3">
              <StaffFields branches={branches} roles={roles} />
            </ActionForm>
          </Card>
        </aside>
      </div>
    </div>
  );
}
