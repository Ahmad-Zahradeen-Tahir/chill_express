import { cn } from "@/lib/cn";

export const inputClass =
  "w-full h-11 rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-brand-orange/20 disabled:bg-paper";

export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...p} />;
}
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "h-auto min-h-20 py-2.5", className)} {...p} />;
}
export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "pr-8", className)} {...p} />;
}
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-brand-red">{error}</span>}
    </label>
  );
}
export function Alert({ tone = "info", children, className }: { tone?: "info" | "error" | "success" | "warn"; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "bg-orange-50 border-orange-200 text-ink",
    error: "bg-red-50 border-red-100 text-red-900",
    success: "bg-success-50 border-green-200 text-green-900",
    warn: "bg-orange-100 border-orange-200 text-ink",
  };
  return <div role={tone === "error" ? "alert" : undefined} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>;
}
