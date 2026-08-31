import { CropDialog } from "@/components/media/CropDialog";
import { ImageWell } from "@/components/media/MediaBay";
import { PreviewStage } from "@/components/shared/PreviewStage";
import { Fold } from "@/components/shared/Fold";
import { LoraList, ModelSelect, SeedRow } from "@/components/shared/InspectorBits";
import { NumberField } from "@/components/ui/number-field";
import { Input, Textarea } from "@/components/ui/field";
import { InsetGroup, InsetRow, Chip, Segmented } from "@/components/ui/group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PresetBar } from "@/components/shared/PresetBar";
import { ResolutionPicker } from "@/components/shared/ResolutionPicker";
import { StylePanel } from "@/components/shared/StylePanel";
import { composeKreaPrompt } from "@/lib/export-workflow";
import { itemFromFile } from "@/lib/media";
import { REASONING } from "@/lib/presets";
import { runBay } from "@/lib/run";
import { useLab } from "@/lib/store";
import { useMemo, useState } from "react";
import { Zap } from "lucide-react";

export function KreaWorkspace() {
  const krea = useLab((s) => s.krea);
  const patch = useLab((s) => s.patchKrea);
  const preview = useLab((s) => s.previewKrea);
  const liveFrame = useLab((s) => s.liveFrame);
  const liveHint = useLab((s) => s.liveHint);
  const liveProgress = useLab((s) => s.liveProgress);
  const liveTick = useLab((s) => s.liveTick);
  const catalogs = useLab((s) => s.catalogs);
  const runningId = useLab((s) => s.runningId);
  const jobs = useLab((s) => s.jobs);
  const running = jobs.find((j) => j.id === runningId && j.bay === "krea");
  const [crop, setCrop] = useState(false);
  const finalPrompt = useMemo(() => composeKreaPrompt(krea), [krea]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PreviewStage
          url={preview}
          kind="image"
          running={Boolean(running)}
          liveUrl={liveFrame}
          liveTick={liveTick}
          hint={liveHint}
          progress={Math.max(liveProgress, running?.progress ?? 0)}
          empty="Напиши сцену, выбери стиль и LoRA. Пуск соберёт кадр."
        />
      </div>
      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-4 pr-1 lg:pb-4">
        <InsetGroup header="Пресеты">
          <PresetBar bay="krea" />
        </InsetGroup>

        <InsetGroup header="Промпт">
          <div className="p-2">
            <Textarea
              value={krea.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder="Сцена, персонаж, свет…"
              className="min-h-28 border-0 bg-transparent px-2"
            />
          </div>
          <InsetRow label="LLM Enhance">
            <Switch checked={krea.llmEnhance} onCheckedChange={(v) => patch({ llmEnhance: v })} />
          </InsetRow>
          <InsetRow label="Trigger words">
            <Switch checked={krea.triggerOn} onCheckedChange={(v) => patch({ triggerOn: v })} />
          </InsetRow>
          {krea.triggerOn ? (
            <div className="border-t border-line p-2">
              <Input value={krea.triggerWords} onChange={(e) => patch({ triggerWords: e.target.value })} />
            </div>
          ) : null}
          <InsetRow label="Доп. промпт">
            <Switch checked={krea.extraOn} onCheckedChange={(v) => patch({ extraOn: v })} />
          </InsetRow>
          {krea.extraOn ? (
            <div className="border-t border-line p-2">
              <Input value={krea.extraPrompt} onChange={(e) => patch({ extraPrompt: e.target.value })} />
            </div>
          ) : null}
          <div className="border-t border-line px-3.5 py-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-subtle">Итоговый промпт</p>
            <p className="text-xs leading-relaxed text-muted">{finalPrompt || "—"}</p>
          </div>
        </InsetGroup>

        <StylePanel prompt={krea.prompt} onPrompt={(prompt) => patch({ prompt })} />

        <InsetGroup header="Кадр">
          <ResolutionPicker
            ratio={krea.ratio}
            megapixels={krea.megapixels ?? 2}
            snap={krea.snap ?? 64}
            resMode={krea.resMode ?? "preset"}
            customW={krea.customW}
            customH={krea.customH}
            customRw={krea.customRw ?? 2}
            customRh={krea.customRh ?? 3}
            mpMin={0.25}
            mpMax={4}
            mpStep={0.01}
            onChange={(p) => patch(p)}
          />
          <SeedRow
            label="Seed image"
            value={krea.seedImage}
            onChange={(n) => patch({ seedImage: n })}
            onRoll={() => useLab.getState().randomizeSeed("kreaImage")}
          />
          {krea.llmEnhance ? (
            <SeedRow
              label="Seed LLM"
              value={krea.seedLlm}
              onChange={(n) => patch({ seedLlm: n })}
              onRoll={() => useLab.getState().randomizeSeed("kreaLlm")}
            />
          ) : null}
          <InsetRow label="UNET">
            <ModelSelect value={krea.unet} options={catalogs.unet} onChange={(unet) => patch({ unet })} />
          </InsetRow>
          <InsetRow label="Steps">
            <NumberField value={krea.steps} min={4} max={30} digits={0} onChange={(n) => patch({ steps: Math.round(n) })} />
            <Slider min={4} max={30} step={1} value={krea.steps} onChange={(v) => patch({ steps: v })} />
          </InsetRow>
          <InsetRow label="Sampler">
            <ModelSelect value={krea.sampler} options={catalogs.samplers} onChange={(sampler) => patch({ sampler })} />
          </InsetRow>
          <InsetRow label="Scheduler">
            <ModelSelect value={krea.scheduler} options={catalogs.schedulers} onChange={(scheduler) => patch({ scheduler })} />
          </InsetRow>
        </InsetGroup>

        <Fold title="Апскейл" hint="После генерации · целый кадр, без тайлов" defaultOpen>
          <InsetRow label="Denoise">
            <NumberField value={krea.denoise ?? 0.28} min={0} max={1} digits={2} onChange={(n) => patch({ denoise: n })} />
            <Slider min={0} max={1} step={0.01} value={krea.denoise ?? 0.28} onChange={(v) => patch({ denoise: v })} />
          </InsetRow>
          <InsetRow label="Мегапиксели">
            <div className="flex flex-wrap gap-1">
              {[1, 2, 4, 6, 8].map((n) => (
                <Chip key={n} active={(krea.upscaleMp ?? 6) === n} onClick={() => patch({ upscaleMp: n })}>
                  {n} МП
                </Chip>
              ))}
            </div>
          </InsetRow>
          <InsetRow label="">
            <NumberField
              value={krea.upscaleMp ?? 6}
              min={0.25}
              max={16}
              digits={2}
              onChange={(n) => patch({ upscaleMp: n })}
            />
            <Slider min={0.25} max={8} step={0.25} value={krea.upscaleMp ?? 6} onChange={(v) => patch({ upscaleMp: v })} />
          </InsetRow>
          <InsetRow label="SNAP">
            <Segmented
              size="sm"
              value={String(krea.upscaleSnap ?? 16)}
              onChange={(v) => patch({ upscaleSnap: Number(v) })}
              options={[8, 16, 32, 64].map((n) => ({ id: String(n), label: String(n) }))}
            />
          </InsetRow>
          <div className="p-3">
            <Button
              variant="subtle"
              className="w-full"
              disabled={Boolean(running)}
              onClick={() => void runBay("krea", { upscale: true })}
            >
              <Zap className="size-3.5" />
              Апскейл кадра
            </Button>
          </div>
        </Fold>

        <InsetGroup header="LoRA">
          <InsetRow label="Enable LoRA">
            <Switch checked={krea.loraOn} onCheckedChange={(v) => patch({ loraOn: v })} />
          </InsetRow>
          {krea.loraOn ? (
            <LoraList
              bay="krea"
              items={krea.loras}
              onToggle={(id, on) => patch({ loras: krea.loras.map((l) => (l.id === id ? { ...l, on } : l)) })}
              onStrength={(id, strength) =>
                patch({ loras: krea.loras.map((l) => (l.id === id ? { ...l, strength } : l)) })
              }
            />
          ) : null}
        </InsetGroup>

        {krea.llmEnhance ? (
        <InsetGroup header="LLM · vision">
          <div className="p-3">
            <ImageWell
              item={krea.loadImage}
              label="Кадр для LLM"
              compact
              onChange={(file) => void itemFromFile(file, "picture").then((it) => patch({ loadImage: it }))}
              onCrop={() => krea.loadImage && setCrop(true)}
              onClear={() => patch({ loadImage: null })}
            />
          </div>
          <InsetRow label="Модель">
            <ModelSelect value={krea.llmModel} options={catalogs.llm} onChange={(llmModel) => patch({ llmModel })} />
          </InsetRow>
          <InsetRow label="mmproj">
            <ModelSelect value={krea.mmproj} options={catalogs.mmproj} onChange={(mmproj) => patch({ mmproj })} />
          </InsetRow>
          <InsetRow label="Reasoning">
            <ModelSelect value={krea.reasoning} options={[...REASONING]} onChange={(reasoning) => patch({ reasoning })} />
          </InsetRow>
          <InsetRow label="System prompt">
            <ModelSelect
              value={krea.systemPrompt}
              options={catalogs.systemPrompts}
              onChange={(systemPrompt) => patch({ systemPrompt })}
            />
          </InsetRow>
        </InsetGroup>
        ) : null}
      </aside>
      {crop && krea.loadImage ? (
        <CropDialog
          item={krea.loadImage}
          onClose={() => setCrop(false)}
          onApply={(c, url) => {
            patch({ loadImage: { ...krea.loadImage!, crop: c, croppedUrl: url } });
            setCrop(false);
          }}
        />
      ) : null}
    </div>
  );
}
