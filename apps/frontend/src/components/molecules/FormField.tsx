import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-sepia">
        {label}
      </label>
      {children}
      {hint ? <span className="text-xs text-dust">{hint}</span> : null}
    </div>
  );
}
