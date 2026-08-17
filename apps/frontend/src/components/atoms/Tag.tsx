import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "teal" | "mustard" }) {
  const tones = {
    neutral: "bg-parchment text-sepia",
    teal: "bg-teal/15 text-teal",
    mustard: "bg-mustard/20 text-amber",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}
