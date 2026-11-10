import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "red" | "dark" | "outline" | "ghost" | "white" | "success";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-brand-orange text-ink hover:bg-orange-600 hover:text-white",
  red: "bg-brand-red text-white hover:bg-red-700",
  dark: "bg-ink text-white hover:bg-ink-2",
  outline: "border-2 border-ink/15 bg-white text-ink hover:border-ink/40",
  ghost: "text-ink hover:bg-ink/5",
  white: "bg-white text-brand-red hover:bg-orange-50",
  success: "bg-success text-white hover:bg-green-800",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
