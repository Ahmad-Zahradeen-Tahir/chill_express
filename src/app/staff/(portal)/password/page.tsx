import { requireStaffPage } from "@/server/auth/guard";
import { PasswordForm } from "./form";

export default async function PasswordPage() {
  await requireStaffPage();
  return (
    <div className="max-w-md">
      <h1 className="font-display text-5xl font-extrabold uppercase leading-none">Change password</h1>
      <p className="mb-6 mt-1 text-sm text-ink-3">Use at least 10 characters. Other sessions will be signed out.</p>
      <PasswordForm />
    </div>
  );
}
