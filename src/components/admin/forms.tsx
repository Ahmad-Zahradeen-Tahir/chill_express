"use client";
import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form";

type R = { ok?: boolean; error?: string; tempPassword?: string };

/** Generic form wrapper for (prevState, FormData) server actions. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  successText = "Saved.",
  variant = "dark",
}: {
  action: (s: R, f: FormData) => Promise<R>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  successText?: string;
  variant?: "dark" | "red" | "outline";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && <Alert tone="error" className="mt-3">{state.error}</Alert>}
      {state.ok && !state.tempPassword && <Alert tone="success" className="mt-3">{successText}</Alert>}
      {state.tempPassword && (
        <Alert tone="success" className="mt-3">
          Temporary password (shown once — share it privately): <code className="ml-1 rounded bg-white px-2 py-0.5 font-mono font-bold">{state.tempPassword}</code>
          <span className="mt-1 block text-xs">They must choose a new password after signing in.</span>
        </Alert>
      )}
      <Button type="submit" size="sm" variant={variant} disabled={pending} className="mt-3">{pending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}

export function ConfirmButton({ onConfirm, label, confirmText, variant = "outline" }: { onConfirm: () => Promise<unknown>; label: string; confirmText: string; variant?: "outline" | "red" | "ghost" }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" size="sm" variant={variant} disabled={pending} onClick={() => confirm(confirmText) && start(async () => void (await onConfirm()))}>
      {label}
    </Button>
  );
}

export function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-brand-red" /> {label}
    </label>
  );
}
