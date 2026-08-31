import { LoraPicker } from "@/components/shared/LoraPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { InsetRow } from "@/components/ui/group";
import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { folderOf } from "@/lib/lora-tree";
import { useLab } from "@/lib/store";
import type { Bay, LoraItem, RatioPreset } from "@/lib/types";
import { Dices, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function SeedRow({
  label,
  value,
  onChange,
  onRoll,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  onRoll: () => void;
}) {
  return (
    <InsetRow label={label}>
      <input
        className="w-24 bg-transparent text-right font-mono text-sm tabular-nums outline-none"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <button type="button" onClick={onRoll} className="text-muted hover:text-fg" aria-label="Новый сид">
        <Dices className="size-4" />
      </button>
    </InsetRow>
  );
}

export function RatioRow({
  value,
  list,
  customW,
  customH,
  onRatio,
  onCustom,
}: {
  value: string;
  list: RatioPreset[];
  customW: number;
  customH: number;
  onRatio: (id: string) => void;
  onCustom: (w: number, h: number) => void;
}) {
  return (
    <>
      <InsetRow label="Соотношение">
        <select
          className="h-8 max-w-[140px] rounded-md bg-chip px-2 text-sm outline-none"
          value={value}
          onChange={(e) => onRatio(e.target.value)}
        >
          {list.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
              {r.id !== "custom" ? ` · ${r.w}×${r.h}` : ""}
            </option>
          ))}
        </select>
      </InsetRow>
      {value === "custom" ? (
        <InsetRow label="Размер">
          <Input
            className="h-8 w-16 px-2 text-center"
            value={customW}
            onChange={(e) => onCustom(Number(e.target.value) || 0, customH)}
          />
          <span className="text-subtle">×</span>
          <Input
            className="h-8 w-16 px-2 text-center"
            value={customH}
            onChange={(e) => onCustom(customW, Number(e.target.value) || 0)}
          />
        </InsetRow>
      ) : null}
    </>
  );
}

export function LoraList({
  bay,
  items,
  onToggle,
  onStrength,
}: {
  bay: Bay;
  items: LoraItem[];
  onToggle: (id: string, on: boolean) => void;
  onStrength: (id: string, s: number) => void;
}) {
  const removeLora = useLab((s) => s.removeLora);
  const [open, setOpen] = useState(false);
  const used = new Set(items.map((l) => l.file));
  const visible = items.filter((l) => !l.hidden);

  return (
    <div>
      {visible.length === 0 ? (
        <p className="px-3.5 py-3 text-sm text-muted">Пока пусто — добавь LoRA из Comfy.</p>
      ) : (
        visible.map((l) => (
          <div key={l.id} className="flex min-h-11 items-center gap-2 border-b border-line px-3 last:border-b-0">
            <Switch checked={l.on} onCheckedChange={(v) => onToggle(l.id, v)} />
            <span className={cn("min-w-0 flex-1", l.on ? "text-fg" : "text-muted")} title={l.file}>
              <span className="block truncate text-sm">{l.name}</span>
              {folderOf(l.file) ? (
                <span className="block truncate text-[10px] text-subtle">{folderOf(l.file)}</span>
              ) : null}
            </span>
            <NumberField
              value={l.strength}
              min={0}
              max={1.5}
              digits={2}
              className="w-10 shrink-0 bg-transparent px-0"
              onChange={(n) => onStrength(l.id, n)}
            />
            <Slider
              className="w-16 shrink-0"
              min={0}
              max={1.5}
              step={0.05}
              value={l.strength}
              onChange={(v) => onStrength(l.id, v)}
            />
            <button
              type="button"
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:text-danger"
              onClick={() => removeLora(bay, l.id)}
              aria-label={`Удалить ${l.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center gap-2 px-3.5 text-sm text-muted hover:text-fg"
      >
        <Plus className="size-3.5" />
        Добавить LoRA
      </button>
      <LoraPicker open={open} onClose={() => setOpen(false)} bay={bay} used={used} />
    </div>
  );
}

export function StyleGrid({
  styles,
  value,
  onChange,
}: {
  styles: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (id === "none") {
      onChange([]);
      return;
    }
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value.filter((x) => x !== "none"), id]);
  }
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {styles.map((s) => {
          const on = s.id === "none" ? value.length === 0 : value.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={cn(
                "relative flex aspect-[4/3] flex-col overflow-hidden rounded-lg text-left",
                on ? "ring-2 ring-accent" : "ring-1 ring-transparent hover:ring-line-strong",
              )}
            >
              <span className={cn("flex-1", swatchFor(s.id))} />
              <span
                className={cn(
                  "px-2 py-1 text-[11px] font-medium",
                  on ? "bg-accent text-accent-fg" : "bg-chip text-muted",
                )}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-3 pb-3 text-[11px] leading-relaxed text-muted">
        Можно несколько сразу — каждый включает свои LoRA и trigger words. Картинки из ноды Comfy подтянем, когда
        будет связь; пока локальный набор.
      </p>
    </div>
  );
}

function swatchFor(id: string) {
  switch (id) {
    case "prettycake":
      return "bg-gradient-to-br from-accent/40 to-chip";
    case "tooncore":
      return "bg-gradient-to-br from-ok/40 to-chip";
    case "niji":
      return "bg-gradient-to-br from-primary/30 to-accent/30";
    case "gpt2":
      return "bg-gradient-to-br from-muted/40 to-chip";
    case "cinematic":
      return "bg-gradient-to-br from-bg to-accent/20";
    case "realism":
      return "bg-gradient-to-br from-elevated to-muted/20";
    case "bloom":
      return "bg-gradient-to-br from-accent/25 to-ok/20";
    case "zero":
      return "bg-gradient-to-br from-danger/20 to-chip";
    default:
      return "bg-chip";
  }
}

export function ModelSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      className={cn("h-8 max-w-[180px] rounded-md bg-chip px-2 text-xs outline-none", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {list.map((m) => (
        <option key={m} value={m}>
          {m.split(/[/\\]/).pop()}
        </option>
      ))}
    </select>
  );
}

export function RunButton({
  running,
  progress,
  onClick,
  label,
}: {
  running: boolean;
  progress: number;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      variant="primary"
      size="lg"
      className="relative w-full overflow-hidden"
      onClick={onClick}
      disabled={running}
    >
      {running ? (
        <span
          className="absolute inset-y-0 left-0 bg-accent/40"
          style={{ width: `${progress}%` }}
        />
      ) : null}
      <span className="relative">{running ? "Прогон…" : label}</span>
    </Button>
  );
}
