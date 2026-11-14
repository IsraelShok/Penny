"use client";

import { InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Labelled number input with an optional unit (₪, %) and an inline error under it. */
export function NumberField({ id, label, value, onChange, unit, placeholder, error, min = "0" }: {
  id: string; label: string; value: string | number; onChange: (v: string) => void;
  unit?: string; placeholder?: string; error?: string | null; min?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="leading-5">{label}</Label>
      <InputGroup suffix={unit} className="aria-invalid:border-destructive" aria-invalid={!!error || undefined}>
        <input
          id={id} type="number" inputMode="decimal" step="any" min={min} dir="ltr" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-err` : undefined}
          className="w-full min-w-0 flex-1 bg-transparent text-base tabular-nums outline-none [appearance:textfield] placeholder:text-muted-foreground sm:text-sm rtl:text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </InputGroup>
      {error && <p id={`${id}-err`} className="text-caption text-destructive">{error}</p>}
    </div>
  );
}

/** "" or a finite number ≥ min is fine; anything else gets the message. */
export const numberError = (raw: string, message: string, min = 0) => {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? null : message;
};
