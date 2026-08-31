import { cn } from "@/lib/utils";

export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn("h-8 min-w-0 w-28 flex-1 accent-accent", className)}
    />
  );
}
