import { Input } from "@/components/ui/field";
import { InsetRow } from "@/components/ui/group";
import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import { ASPECTS, SNAP_STEPS, computeResolution, type ResMode } from "@/lib/resolution";
import { cn } from "@/lib/utils";

function AspectGlyph({ a, b }: { a: number; b: number }) {
  const ar = a / b;
  const max = 16;
  const w = ar >= 1 ? max : max * ar;
  const h = ar >= 1 ? max / ar : max;
  return (
    <span
      className="rounded-[2px] bg-current opacity-70"
      style={{ width: w, height: h }}
    />
  );
}

export function ResolutionPicker({
  ratio,
  megapixels,
  snap,
  resMode = "preset",
  customW,
  customH,
  customRw,
  customRh,
  onChange,
  allowCustom = true,
  lockRatio = false,
  mpMin = 0.25,
  mpMax = 4,
  mpStep = 0.01,
}: {
  ratio: string;
  megapixels: number;
  snap: number;
  resMode?: ResMode;
  customW: number;
  customH: number;
  customRw: number;
  customRh: number;
  allowCustom?: boolean;
  lockRatio?: boolean;
  mpMin?: number;
  mpMax?: number;
  mpStep?: number;
  onChange: (p: {
    ratio?: string;
    megapixels?: number;
    snap?: number;
    resMode?: ResMode;
    customW?: number;
    customH?: number;
    customRw?: number;
    customRh?: number;
  }) => void;
}) {
  const size = computeResolution({
    ratio,
    megapixels,
    snap,
    resMode,
    customW,
    customH,
    customRw,
    customRh,
  });

  return (
    <div>
      {lockRatio ? (
        <InsetRow label="Соотношение">
          <span className="text-xs text-muted">
            как в генерации · {resMode === "custom_res" ? `${customW}×${customH}` : resMode === "custom_ratio" ? `${customRw}:${customRh}` : ratio}
          </span>
        </InsetRow>
      ) : (
      <div className="grid grid-cols-3 gap-1 p-2">
        {ASPECTS.map((r) => {
          const on = resMode === "preset" && ratio === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange({ ratio: r.id, resMode: "preset" })}
              className={cn(
                "flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
                on ? "bg-accent text-accent-fg" : "bg-chip text-muted hover:text-fg",
              )}
            >
              <AspectGlyph a={r.a} b={r.b} />
              {r.id}
            </button>
          );
        })}
        {allowCustom ? (
          <>
            <button
              type="button"
              onClick={() => onChange({ resMode: "custom_ratio" })}
              className={cn(
                "col-span-2 flex h-10 items-center justify-center rounded-lg text-[11px] font-medium",
                resMode === "custom_ratio" ? "bg-accent text-accent-fg" : "bg-chip text-muted hover:text-fg",
              )}
            >
              Своё соотношение
            </button>
            <button
              type="button"
              onClick={() => onChange({ resMode: "custom_res" })}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg text-[11px] font-medium",
                resMode === "custom_res" ? "bg-accent text-accent-fg" : "bg-chip text-muted hover:text-fg",
              )}
            >
              Свой размер
            </button>
          </>
        ) : null}
      </div>
      )}

      {!lockRatio && resMode === "custom_ratio" ? (
        <InsetRow label="Стороны">
          <Input
            className="h-8 w-14 px-2 text-center"
            value={customRw}
            onChange={(e) => onChange({ customRw: Number(e.target.value) || 1, resMode: "custom_ratio" })}
          />
          <span className="text-subtle">:</span>
          <Input
            className="h-8 w-14 px-2 text-center"
            value={customRh}
            onChange={(e) => onChange({ customRh: Number(e.target.value) || 1, resMode: "custom_ratio" })}
          />
        </InsetRow>
      ) : null}

      {!lockRatio && resMode === "custom_res" ? (
        <InsetRow label="Пиксели">
          <Input
            className="h-8 w-16 px-2 text-center"
            value={customW}
            onChange={(e) => onChange({ customW: Number(e.target.value) || 0, resMode: "custom_res" })}
          />
          <span className="text-subtle">×</span>
          <Input
            className="h-8 w-16 px-2 text-center"
            value={customH}
            onChange={(e) => onChange({ customH: Number(e.target.value) || 0, resMode: "custom_res" })}
          />
        </InsetRow>
      ) : null}

      {resMode !== "custom_res" ? (
        <InsetRow label="Мегапиксели">
          <NumberField
            value={megapixels}
            min={mpMin}
            max={mpMax}
            digits={2}
            onChange={(n) => onChange({ megapixels: n })}
          />
          <Slider min={mpMin} max={mpMax} step={mpStep} value={megapixels} onChange={(v) => onChange({ megapixels: v })} />
        </InsetRow>
      ) : null}

      <div className="flex items-center gap-1.5 border-t border-line px-3 py-2">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">Snap</span>
        {SNAP_STEPS.map((n) => {
          const on = snap === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ snap: n })}
              className={cn(
                "h-7 min-w-8 rounded-md px-2 text-xs font-medium",
                on ? "bg-accent text-accent-fg" : "bg-chip text-muted hover:text-fg",
              )}
            >
              {n === 0 ? "Off" : n}
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between border-t border-line px-3.5 py-3">
        <span className="font-mono text-lg tabular-nums tracking-tight">
          {size.w} × {size.h}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted">{size.mp.toFixed(2)} МП</span>
      </div>
    </div>
  );
}
