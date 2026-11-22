"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Labelled number input for calculators; empty or invalid input counts as 0, values clamp to min/max. */
export function NumField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`num-${id}`}>{label}</Label>
      <Input
        id={`num-${id}`}
        type="number"
        inputMode="decimal"
        dir="ltr"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          onChange(
            Number.isFinite(v) ? Math.max(min, max === undefined ? v : Math.min(max, v)) : 0,
          );
        }}
      />
    </div>
  );
}
