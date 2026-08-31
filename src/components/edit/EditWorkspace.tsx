import { CropDialog } from "@/components/media/CropDialog";
import { ImageWell } from "@/components/media/MediaBay";
import { PreviewStage } from "@/components/shared/PreviewStage";
import { LoraList, SeedRow } from "@/components/shared/InspectorBits";
import { PresetBar } from "@/components/shared/PresetBar";
import { ResolutionPicker } from "@/components/shared/ResolutionPicker";
import { StylePanel } from "@/components/shared/StylePanel";
import { Fold } from "@/components/shared/Fold";
import { NumberField } from "@/components/ui/number-field";
import { Textarea } from "@/components/ui/field";
import { InsetGroup, InsetRow } from "@/components/ui/group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { itemFromFile } from "@/lib/media";
import { runBay } from "@/lib/run";
import { useLab } from "@/lib/store";
import { useState } from "react";
import type { MediaItem } from "@/lib/types";
import { Zap } from "lucide-react";

export function EditWorkspace() {
  const edit = useLab((s) => s.edit);
  const patch = useLab((s) => s.patchEdit);
  const preview = useLab((s) => s.previewEdit);
  const compare = useLab((s) => s.compareEdit);
  const liveFrame = useLab((s) => s.liveFrame);
  const liveHint = useLab((s) => s.liveHint);
  const liveProgress = useLab((s) => s.liveProgress);
  const liveTick = useLab((s) => s.liveTick);
  const runningId = useLab((s) => s.runningId);
  const jobs = useLab((s) => s.jobs);
  const running = jobs.find((j) => j.id === runningId && j.bay === "edit");
  const [cropWhich, setCropWhich] = useState<"image1" | "image2" | null>(null);

  async function setFile(which: "image1" | "image2", file: File) {
    const item = await itemFromFile(file, "picture");
    patch({ [which]: item });
  }

  const cropItem: MediaItem | null = cropWhich ? edit[cropWhich] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
        <PreviewStage
          url={preview}
          kind="image"
          compare={compare}
          running={Boolean(running)}
          liveUrl={liveFrame}
          liveTick={liveTick}
          hint={liveHint}
          progress={Math.max(liveProgress, running?.progress ?? 0)}
          empty="Загрузи исходник и карту персонажа. Здесь только правка по инструкции, без LLM."
        />
        <div className="grid shrink-0 grid-cols-1 gap-3 rounded-2xl bg-surface p-3 sm:grid-cols-2 sm:p-4">
          <ImageWell
            item={edit.image1}
            label="Изображение 1 · сцена или персонаж"
            surfaceClass="aspect-video max-h-[200px] sm:aspect-[3/4] sm:max-h-[180px] lg:max-h-[min(200px,28dvh)]"
            onChange={(f) => void setFile("image1", f)}
            onCrop={() => setCropWhich("image1")}
            onClear={() => patch({ image1: null })}
          />
          <ImageWell
            item={edit.image2}
            label="Изображение 2 · карта"
            surfaceClass="aspect-video max-h-[200px] sm:aspect-[3/4] sm:max-h-[180px] lg:max-h-[min(200px,28dvh)]"
            onChange={(f) => void setFile("image2", f)}
            onCrop={() => setCropWhich("image2")}
            onClear={() => patch({ image2: null })}
          />
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-4 pr-1 lg:pb-4">
        <InsetGroup header="Пресеты">
          <PresetBar bay="edit" />
        </InsetGroup>

        <InsetGroup header="Промпт">
          <div className="p-2">
            <Textarea
              value={edit.prompt}
              onChange={(e) => patch({ prompt: e.target.value, preset: "custom" })}
              className="min-h-40 border-0 bg-transparent px-2"
            />
          </div>
        </InsetGroup>

        <StylePanel prompt={edit.prompt} onPrompt={(prompt) => patch({ prompt, preset: "custom" })} />

        <InsetGroup header="Кадр">
          <InsetRow label="Как у исходника">
            <Switch checked={edit.matchSource} onCheckedChange={(v) => patch({ matchSource: v })} />
          </InsetRow>
          {!edit.matchSource ? (
            <ResolutionPicker
              ratio={edit.ratio}
              megapixels={edit.megapixels ?? 1}
              snap={edit.snap ?? 64}
              resMode={edit.resMode ?? "preset"}
              customW={edit.customW}
              customH={edit.customH}
              customRw={edit.customRw ?? 9}
              customRh={edit.customRh ?? 16}
              mpMin={0.25}
              mpMax={4}
              mpStep={0.01}
              onChange={(p) => patch(p)}
            />
          ) : null}
          <SeedRow
            label="Сид"
            value={edit.seed}
            onChange={(n) => patch({ seed: n })}
            onRoll={() => useLab.getState().randomizeSeed("edit")}
          />
        </InsetGroup>

        <InsetGroup header="LoRA">
          <LoraList
            bay="edit"
            items={edit.loras}
            onToggle={(id, on) => patch({ loras: edit.loras.map((l) => (l.id === id ? { ...l, on } : l)) })}
            onStrength={(id, strength) =>
              patch({ loras: edit.loras.map((l) => (l.id === id ? { ...l, strength } : l)) })
            }
          />
        </InsetGroup>

        <Fold title="Апскейл" hint="После генерации · масштаб кадра" defaultOpen>
          <InsetRow label="Сила шума">
            <NumberField value={edit.denoise} min={0} max={1} digits={2} onChange={(n) => patch({ denoise: n })} />
            <Slider min={0} max={1} step={0.01} value={edit.denoise} onChange={(v) => patch({ denoise: v })} />
          </InsetRow>
          <InsetRow label="Масштаб">
            <NumberField value={edit.upscaleBy} min={1} max={4} digits={1} onChange={(n) => patch({ upscaleBy: n })} />
            <Slider min={1} max={4} step={0.1} value={edit.upscaleBy} onChange={(v) => patch({ upscaleBy: v })} />
          </InsetRow>
          <div className="p-3">
            <Button
              variant="subtle"
              className="w-full"
              disabled={Boolean(running) || !preview}
              onClick={() => void runBay("edit", { upscale: true })}
            >
              <Zap className="size-3.5" />
              Апскейл кадра
            </Button>
          </div>
        </Fold>
      </aside>

      {cropItem && cropWhich ? (
        <CropDialog
          item={cropItem}
          onClose={() => setCropWhich(null)}
          onApply={(c, url) => {
            patch({ [cropWhich]: { ...cropItem, crop: c, croppedUrl: url } });
            setCropWhich(null);
          }}
        />
      ) : null}
    </div>
  );
}
