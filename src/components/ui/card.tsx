import { cn } from "@/lib/cn";
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...p} />;
}
export function Badge({ className, tone = "neutral", ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "orange" | "red" | "green" | "dark" | "blue" }) {
  const tones = {
    neutral: "bg-ink/5 text-ink-2",
    orange: "bg-orange-100 text-[#7a4a00]",
    red: "bg-red-50 text-brand-red",
    green: "bg-success-50 text-success",
    dark: "bg-ink text-white",
    blue: "bg-sky-50 text-sky-800",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} {...p} />;
}
