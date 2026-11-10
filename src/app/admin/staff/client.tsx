"use client";
import { useState, useTransition } from "react";
import { resetStaffPassword, setPermissionOverrides, setStaffStatus, updateStaff } from "@/app/actions/staff-admin";
import { ActionForm } from "@/components/admin/forms";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select } from "@/components/ui/form";

type Role = "CASHIER" | "BRANCH_MANAGER" | "CENTRAL_MANAGER" | "CEO";
const LABEL: Record<Role, string> = { CASHIER: "Cashier", BRANCH_MANAGER: "Branch Manager", CENTRAL_MANAGER: "Central Manager", CEO: "CEO" };

export function StaffFields({ branches, roles, person }: { branches: { id: string; name: string }[]; roles: Role[]; person?: { name: string; email: string; phone: string; role: Role; branchIds: string[] } }) {
  const [role, setRole] = useState<Role>(person?.role ?? "CASHIER");
  const scoped = role === "CASHIER" || role === "BRANCH_MANAGER";
  return (
    <div className="grid gap-3">
      <Field label="Full name"><Input name="name" defaultValue={person?.name} required /></Field>
      <Field label="Work email"><Input name="email" type="email" defaultValue={person?.email} required /></Field>
      <Field label="Phone"><Input name="phone" defaultValue={person?.phone} /></Field>
      <Field label="Role">
        <Select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
        </Select>
      </Field>
      {scoped ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink-2">Branches</legend>
          <div className="flex flex-wrap gap-3">
            {branches.map((b) => (
              <label key={b.id} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="branchIds" value={b.id} defaultChecked={person?.branchIds.includes(b.id)} className="size-4 accent-brand-red" /> {b.name}</label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="text-xs text-ink-3">{LABEL[role]} has access to all branches.</p>
      )}
    </div>
  );
}

export function StaffRowActions({
  person,
  branches,
  roles,
  effective,
  permissions,
  editable,
}: {
  person: { id: string; name: string; email: string; phone: string; role: Role; status: string; branchIds: string[]; self: boolean };
  branches: { id: string; name: string }[];
  roles: Role[];
  effective: string[];
  permissions: { key: string; label: string }[];
  editable: boolean;
}) {
  const [panel, setPanel] = useState<null | "edit" | "perms">(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: React.ReactNode } | null>(null);
  const [perms, setPerms] = useState(new Set(effective));
  if (!editable) return null;
  const act = (fn: () => Promise<{ ok?: boolean; error?: string; tempPassword?: string }>, okText?: string) =>
    start(async () => {
      const r = await fn();
      if (r.error) setMsg({ tone: "error", text: r.error });
      else if (r.tempPassword) setMsg({ tone: "success", text: <>Temporary password (shown once): <code className="rounded bg-white px-2 font-mono font-bold">{r.tempPassword}</code></> });
      else setMsg({ tone: "success", text: okText ?? "Saved." });
    });
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setPanel(panel === "edit" ? null : "edit")}>Edit</Button>
        {person.role !== "CEO" && <Button size="sm" variant="outline" onClick={() => setPanel(panel === "perms" ? null : "perms")}>Permissions</Button>}
        {!person.self && <Button size="sm" variant="outline" disabled={pending} onClick={() => confirm(`Reset password for ${person.name}? They will be signed out.`) && act(() => resetStaffPassword(person.id))}>Reset password</Button>}
        {!person.self && (person.status === "ACTIVE" ? (
          <Button size="sm" variant="red" disabled={pending} onClick={() => confirm(`Suspend ${person.name}? They will be signed out immediately.`) && act(() => setStaffStatus(person.id, "SUSPENDED"), "Suspended.")}>Suspend</Button>
        ) : (
          <Button size="sm" variant="success" disabled={pending} onClick={() => act(() => setStaffStatus(person.id, "ACTIVE"), "Reactivated.")}>Reactivate</Button>
        ))}
      </div>
      {msg && <Alert tone={msg.tone} className="mt-2">{msg.text}</Alert>}
      {panel === "edit" && (
        <ActionForm action={updateStaff.bind(null, person.id)} className="mt-3 rounded-2xl bg-paper p-4">
          <StaffFields branches={branches} roles={roles} person={person} />
        </ActionForm>
      )}
      {panel === "perms" && (
        <div className="mt-3 rounded-2xl bg-paper p-4">
          <p className="text-xs text-ink-3">Starts from the role’s defaults. Differences are saved as per-person overrides. Branch restrictions still apply.</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {permissions.map((p) => (
              <label key={p.key} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-brand-red" checked={perms.has(p.key)} onChange={(e) => setPerms((s) => { const n = new Set(s); if (e.target.checked) n.add(p.key); else n.delete(p.key); return n; })} />
                <span><span className="font-mono text-xs">{p.key}</span><span className="block text-xs text-ink-3">{p.label}</span></span>
              </label>
            ))}
          </div>
          <Button size="sm" variant="dark" className="mt-3" disabled={pending} onClick={() => act(() => setPermissionOverrides(person.id, [...perms]), "Permissions saved.")}>Save permissions</Button>
        </div>
      )}
    </div>
  );
}
