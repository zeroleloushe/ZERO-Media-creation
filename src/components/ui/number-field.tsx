import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function NumberField({
  value,
  onChange,
  min,
  max,
  digits = 2,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  digits?: number;
  className?: string;
}) {
  const fmt = (n: number) => Number(n.toFixed(digits)).toString();
  const [raw, setRaw] = useState(fmt(value));
  useEffect(() => setRaw(fmt(value)), [value, digits]);

  function commit() {
    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) {
      setRaw(fmt(value));
      return;
    }
    const next = Math.min(max, Math.max(min, n));
    onChange(next);
    setRaw(fmt(next));
  }

  return (
    <input
      inputMode="decimal"
      className={cn(
        "h-8 w-12 rounded-md bg-chip px-1 text-center font-mono text-xs tabular-nums text-fg outline-none focus:border focus:border-line-strong",
        className,
      )}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
      aria-valuemin={min}
      aria-valuemax={max}
    />
  );
}
