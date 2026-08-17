import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-dust bg-cream/70 px-3 py-2 text-sepia shadow-groove",
        "placeholder:text-dust focus:border-mustard focus:outline-none focus:ring-1 focus:ring-mustard",
        className,
      )}
      {...props}
    />
  );
}
