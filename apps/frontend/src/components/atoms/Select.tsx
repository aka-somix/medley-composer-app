import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-lg border border-dust bg-cream/70 px-3 py-2 text-sepia shadow-groove",
        "focus:border-mustard focus:outline-none focus:ring-1 focus:ring-mustard",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
