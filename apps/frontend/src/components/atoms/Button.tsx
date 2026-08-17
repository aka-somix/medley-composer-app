import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

type Variant = "primary" | "ghost" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: "bg-rust text-cream hover:bg-amber shadow-vinyl",
  ghost: "bg-transparent text-sepia hover:bg-parchment",
  outline: "bg-transparent text-sepia border border-dust hover:bg-parchment",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
        "transition-colors focus:outline-none focus:ring-2 focus:ring-mustard focus:ring-offset-2 focus:ring-offset-cream",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
