import { Button } from "../atoms/Button.js";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-4 text-sm text-sepia">
      <Button variant="outline" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        ← Prev
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button variant="outline" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next →
      </Button>
    </div>
  );
}
