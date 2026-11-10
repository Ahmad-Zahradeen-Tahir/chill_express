import Image from "next/image";
import { cn } from "@/lib/cn";

/** Official logo (white wordmark for orange/red/dark backgrounds, dark wordmark for light backgrounds). */
export function Logo({ variant = "light-bg", className, priority }: { variant?: "light-bg" | "on-brand" | "white"; className?: string; priority?: boolean }) {
  return (
    <Image
      src={variant === "on-brand" ? "/images/brand/logo.png" : variant === "white" ? "/images/brand/logo-white.png" : "/images/brand/logo-dark.png"}
      alt="Chill. Express"
      width={383}
      height={121}
      priority={priority}
      className={cn("h-9 w-auto", className)}
    />
  );
}
