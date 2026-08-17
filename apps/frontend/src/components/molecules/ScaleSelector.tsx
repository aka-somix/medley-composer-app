import { Select } from "../atoms/Select.js";
import { SCALE_OPTIONS } from "../../lib/scales.js";

export function ScaleSelector({ value, onChange }: { value: string; onChange: (scale: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-sepia">
      <span className="font-semibold">Display scale</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Display scale">
        {SCALE_OPTIONS.map((scale) => (
          <option key={scale} value={scale}>
            {scale}
          </option>
        ))}
      </Select>
    </label>
  );
}
