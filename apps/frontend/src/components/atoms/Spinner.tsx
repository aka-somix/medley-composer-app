export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sepia/70" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-dust border-t-rust" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
