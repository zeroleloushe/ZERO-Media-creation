import { ImageWell } from "@/components/media/MediaBay";
import { TrimDialog } from "@/components/media/TrimDialog";
import { PreviewStage } from "@/components/shared/PreviewStage";
import { LoraList, ModelSelect, SeedRow } from "@/components/shared/InspectorBits";
import { PresetBar } from "@/components/shared/PresetBar";
import { Fold } from "@/components/shared/Fold";
import { Textarea } from "@/components/ui/field";
import { InsetGroup, InsetRow, Segmented } from "@/components/ui/group";
import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import { itemFromFile, forgetMedia } from "@/lib/media";
import { pickFiles } from "@/lib/file-pick";
import { computeResolution } from "@/lib/resolution";
import { useLab } from "@/lib/store";
import { Plus, Scissors } from "lucide-react";
import { useState } from "react";

export function UpscaleWorkspace() {
  const u = useLab((s) => s.upscale);
  const patch = useLab((s) => s.patchUpscale);
  const preview = useLab((s) => s.previewUpscale);
  const liveFrame = useLab((s) => s.liveFrame);
  const liveFrames = useLab((s) => s.liveFrames);
  const liveHint = useLab((s) => s.liveHint);
  const liveProgress = useLab((s) => s.liveProgress);
  const liveMime = useLab((s) => s.liveMime);
  const liveFps = useLab((s) => s.liveFps);
  const liveTick = useLab((s) => s.liveTick);
  const catalogs = useLab((s) => s.catalogs);
  const runningId = useLab((s) => s.runningId);
  const jobs = useLab((s) => s.jobs);
  const running = jobs.find((j) => j.id === runningId && j.bay === "upscale");
  const [trim, setTrim] = useState(false);

  const srcW = u.source?.width || 0;
  const srcH = u.source?.height || 0;
  const size =
    srcW && srcH
      ? computeResolution({
          ratio: `${srcW}:${srcH}`,
          megapixels: u.megapixels,
          snap: u.snap,
          resMode: "custom_ratio",
          customRw: srcW,
          customRh: srcH,
        })
      : null;

  async function setSource(file: File) {
    if (u.source) void forgetMedia(u.source);
    const item = await itemFromFile(file, "video");
    patch({ source: item, useH3Latent: false });
  }

  async function addRef(files: FileList | File[]) {
    const next = [...u.pictures];
    for (const f of Array.from(files)) {
      if (next.length >= 9) break;
      next.push(await itemFromFile(f, "picture"));
    }
    patch({ pictures: next });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto lg:h-full lg:overflow-hidden">
        <PreviewStage
          url={preview}
          kind="video"
          running={Boolean(running)}
          liveUrl={liveFrame}
          liveFrames={liveFrames}
          liveFps={liveFps}
          liveMime={liveMime}
          liveTick={liveTick}
          hint={liveHint}
          progress={Math.max(liveProgress, running?.progress ?? 0)}
          empty={
            u.useH3Latent
              ? "Латент первого прохода H3 → апскейлер, без encode."
              : "Загрузи ролик или возьми его из галереи. Пуск прогонит encode → upscale → чанки MiniMax."
          }
          className="min-h-[160px] max-h-[min(46dvh,520px)] shrink-0 lg:max-h-[min(52dvh,640px)]"
        />
        <div className="min-h-[140px] flex-1 overflow-y-auto overscroll-contain rounded-2xl bg-surface p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <ImageWell
              item={u.source}
              label="Исходное видео"
              compact
              accept="video/*"
              kind="video"
              onChange={(f) => void setSource(f)}
              onClear={() => {
                void forgetMedia(u.source);
                patch({ source: null, useH3Latent: false });
              }}
            />
            {u.useH3Latent ? (
              <p className="mt-2 text-[11px] text-muted">Латент H3 · без VAE encode</p>
            ) : u.source ? (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-chip px-2 py-1 text-[11px] text-muted hover:text-fg"
                onClick={() => setTrim(true)}
              >
                <Scissors className="size-3.5" />
                Trim
              </button>
            ) : null}
            </div>
            <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
              Референсы · персонаж / локация
            </p>
            <div className="flex flex-wrap gap-2">
              {u.pictures.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="relative size-[72px] overflow-hidden rounded-lg bg-elevated"
                  onClick={() => {
                    void forgetMedia(p);
                    patch({ pictures: u.pictures.filter((x) => x.id !== p.id) });
                  }}
                  title="Убрать"
                >
                  <img src={p.croppedUrl || p.url} alt="" className="size-full object-cover" />
                </button>
              ))}
              {u.pictures.length < 9 ? (
                <button
                  type="button"
                  className="grid size-[72px] cursor-pointer place-items-center rounded-lg border border-dashed border-line text-muted hover:text-fg"
                  onClick={() => {
                    void pickFiles({ accept: "image/*", multiple: true }).then((files) => {
                      if (files.length) void addRef(files);
                    });
                  }}
                >
                  <Plus className="size-4" />
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-subtle">
              Идут во все чанки. Со 2-го чанка плюс последний кадр предыдущего.
            </p>
          </div>
          </div>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-4 pr-1 lg:pb-4">
        <InsetGroup header="Пресеты">
          <PresetBar bay="upscale" />
        </InsetGroup>

        <InsetGroup header="Промпт">
          <div className="p-2">
            <Textarea
              value={u.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              className="h-40 min-h-32 max-h-[70vh] overflow-y-auto border-0 bg-transparent px-2"
            />
          </div>
        </InsetGroup>

        <InsetGroup header="Кадр">
          <InsetRow label="Соотношение">
            <span className="font-mono text-sm tabular-nums text-muted">
              {srcW && srcH ? `${srcW}×${srcH}` : "из видео"}
            </span>
          </InsetRow>
          <InsetRow label="Мегапиксели">
            <NumberField value={u.megapixels} min={0.5} max={2.5} digits={1} onChange={(n) => patch({ megapixels: n })} />
            <Slider min={0.5} max={2.5} step={0.1} value={u.megapixels} onChange={(v) => patch({ megapixels: v })} />
          </InsetRow>
          <InsetRow label="Шаг сетки">
            <Segmented
              size="sm"
              value={String(u.snap)}
              onChange={(v) => patch({ snap: Number(v) })}
              options={[16, 32, 64].map((n) => ({ id: String(n), label: String(n) }))}
            />
          </InsetRow>
          {size ? (
            <p className="px-3.5 pb-3 font-mono text-[11px] tabular-nums text-subtle">
              цель {size.w}×{size.h} · {size.mp.toFixed(2)} MP
            </p>
          ) : null}
        </InsetGroup>

        <InsetGroup header="Семплер">
          <InsetRow label="Чанки">
            <Segmented
              size="sm"
              value={String(u.chunks)}
              onChange={(v) => patch({ chunks: Number(v) })}
              options={[1, 2, 3, 4].map((n) => ({ id: String(n), label: String(n) }))}
            />
          </InsetRow>
          <InsetRow label="Сила шума">
            <NumberField value={u.denoise} min={0} max={1} digits={2} onChange={(n) => patch({ denoise: n })} />
            <Slider min={0} max={1} step={0.01} value={u.denoise} onChange={(v) => patch({ denoise: v })} />
          </InsetRow>
          <InsetRow label="Шаги">
            <NumberField value={u.steps} min={2} max={16} digits={0} onChange={(n) => patch({ steps: Math.round(n) })} />
            <Slider min={2} max={16} step={1} value={u.steps} onChange={(v) => patch({ steps: v })} />
          </InsetRow>
          <InsetRow label="Семплер">
            <ModelSelect value={u.sampler} options={catalogs.samplers} onChange={(sampler) => patch({ sampler })} />
          </InsetRow>
          <InsetRow label="Планировщик">
            <ModelSelect value={u.scheduler} options={catalogs.schedulers} onChange={(scheduler) => patch({ scheduler })} />
          </InsetRow>
          <SeedRow
            label="Сид"
            value={u.seed}
            onChange={(n) => patch({ seed: n })}
            onRoll={() => useLab.getState().randomizeSeed("upscale")}
          />
        </InsetGroup>

        <Fold title="Модели">
          <InsetRow label="MiniMax H3">
            <ModelSelect
              value={u.unet}
              options={[
                ...catalogs.unet.filter((n) => /h3|minimax/i.test(n)),
                ...catalogs.unet.filter((n) => !/h3|minimax/i.test(n)),
              ]}
              onChange={(unet) => patch({ unet })}
            />
          </InsetRow>
          <InsetRow label="Латентный апскейлер">
            <ModelSelect
              value={u.upscaleModel}
              options={[
                ...catalogs.upscaleModels.filter((n) => /minimax|h3/i.test(n)),
                ...catalogs.upscaleModels.filter((n) => !/minimax|h3/i.test(n)),
              ]}
              onChange={(upscaleModel) => patch({ upscaleModel })}
            />
          </InsetRow>
        </Fold>

        <InsetGroup header="LoRA">
          <LoraList
            bay="upscale"
            items={u.loras}
            onToggle={(id, on) => patch({ loras: u.loras.map((l) => (l.id === id ? { ...l, on } : l)) })}
            onStrength={(id, strength) =>
              patch({ loras: u.loras.map((l) => (l.id === id ? { ...l, strength } : l)) })
            }
          />
        </InsetGroup>
      </aside>

      {trim && u.source ? (
        <TrimDialog
          item={u.source}
          onClose={() => setTrim(false)}
          onApply={(trimStart, trimLength) => {
            patch({ source: { ...u.source!, trimStart, trimLength } });
            setTrim(false);
          }}
        />
      ) : null}
    </div>
  );
}