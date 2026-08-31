import { MediaBay, MiniMediaBay } from "@/components/media/MediaBay";
import { PreviewStage } from "@/components/shared/PreviewStage";
import { LoraList, ModelSelect, SeedRow } from "@/components/shared/InspectorBits";
import { PresetBar } from "@/components/shared/PresetBar";
import { ResolutionPicker } from "@/components/shared/ResolutionPicker";
import { StylePanel } from "@/components/shared/StylePanel";
import { Textarea } from "@/components/ui/field";
import { Chip, InsetGroup, InsetRow, Segmented } from "@/components/ui/group";
import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  bundleHint,
  chunkJobLabel,
  emptyBundle,
  H3_CHUNK_COUNTS,
  H3_CHUNK_SEC_CHIPS,
  h3ChunkTotal,
  snapH3Chunk,
} from "@/lib/h3-chunks";
import { H3_DURATIONS, REASONING } from "@/lib/presets";
import { sendH3ToLatentUpscale } from "@/lib/run";
import { useLab } from "@/lib/store";
import type { MediaBundle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

function ChunkRefFold({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl bg-elevated">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm">{title}</span>
          {hint ? <span className="block truncate text-[11px] text-subtle">{hint}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-line p-3">{children}</div> : null}
    </div>
  );
}

export function H3Workspace() {
  const h3 = useLab((s) => s.h3);
  const patch = useLab((s) => s.patchH3);
  const preview = useLab((s) => s.previewH3);
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
  const running = jobs.find((j) => j.id === runningId && j.bay === "h3");
  const chunksOn = h3.genMode === "chunks";
  const total = h3ChunkTotal(h3.chunkSec || 8, h3.chunkCount || 3);
  const snapped = snapH3Chunk(h3.chunkSec || 8);

  function setGenMode(mode: "standard" | "chunks") {
    if (mode === "chunks") {
      const prompts = [...(h3.chunkPrompts ?? ["", "", "", "", ""])];
      while (prompts.length < 5) prompts.push("");
      if (!prompts[0]?.trim() && h3.prompt.trim()) prompts[0] = h3.prompt;
      patch({ genMode: mode, chunkPrompts: prompts.slice(0, 5) });
    } else {
      patch({
        genMode: mode,
        prompt: h3.prompt.trim() ? h3.prompt : h3.chunkPrompts?.[0] || "",
      });
    }
  }

  function setRefMode(mode: "shared" | "per_chunk") {
    if (mode === "per_chunk") {
      const refs = (h3.chunkRefs ?? [0, 1, 2, 3, 4].map(() => emptyBundle())).map((b) => ({
        pictures: [...(b.pictures ?? [])],
        videos: [...(b.videos ?? [])],
        audios: [...(b.audios ?? [])],
      }));
      while (refs.length < 5) refs.push(emptyBundle());
      const empty = !refs[0].pictures.length && !refs[0].videos.length && !refs[0].audios.length;
      if (empty && (h3.pictures.length || h3.videos.length || h3.audios.length)) {
        refs[0] = { pictures: h3.pictures, videos: h3.videos, audios: h3.audios };
      }
      patch({ refMode: mode, chunkRefs: refs });
    } else {
      const b = h3.chunkRefs?.[0];
      const empty = !h3.pictures.length && !h3.videos.length && !h3.audios.length;
      patch({
        refMode: mode,
        ...(empty && b ? { pictures: b.pictures, videos: b.videos, audios: b.audios } : {}),
      });
    }
  }

  function setChunkPrompt(index: number, value: string) {
    const next = [...(h3.chunkPrompts ?? ["", "", "", "", ""])];
    while (next.length < 5) next.push("");
    next[index] = value;
    patch({ chunkPrompts: next, ...(index === 0 ? { prompt: value } : {}) });
  }

  function setChunkRefs(index: number, bundle: MediaBundle) {
    const next = [...(h3.chunkRefs ?? [0, 1, 2, 3, 4].map(() => emptyBundle()))];
    while (next.length < 5) next.push(emptyBundle());
    next[index] = bundle;
    patch({ chunkRefs: next });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-h-0 flex-col gap-4 lg:h-full">
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
          empty="Загрузи референсы слева внизу и нажми Пуск. В демо увидишь ролик с платформы."
          onUpscale={() => void sendH3ToLatentUpscale()}
        />
        <div
          className={cn(
            "shrink-0 rounded-2xl bg-surface p-4",
            chunksOn && h3.refMode === "per_chunk" && "max-h-[48vh] overflow-y-auto",
          )}
        >
          {chunksOn ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">Референсы</p>
                <Segmented
                  size="sm"
                  value={h3.refMode}
                  onChange={setRefMode}
                  options={[
                    { id: "shared", label: "Общие" },
                    { id: "per_chunk", label: "По чанкам" },
                  ]}
                />
              </div>
              {h3.refMode === "per_chunk" ? (
                <>
                  <p className="mb-3 text-[12px] leading-relaxed text-muted">
                    Свои кадры / видео / аудио у каждого чанка. Во 2+ чанке: последний кадр →{" "}
                    <span className="font-mono text-fg">{"<Picture 1>"}</span>, хвост 22 кадра →{" "}
                    <span className="font-mono text-fg">{"<Video 1>"}</span>. Склейка — 2 кадра.
                  </p>
                  <div className="space-y-2">
                    {Array.from({ length: total.n }, (_, i) => (
                      <ChunkRefFold
                        key={i}
                        title={`Чанк ${i + 1}`}
                        hint={
                          i === 0
                            ? bundleHint(h3.chunkRefs?.[i])
                            : `${bundleHint(h3.chunkRefs?.[i])} · last → Picture 1`
                        }
                        defaultOpen={i === 0}
                      >
                        <MiniMediaBay
                          bundle={h3.chunkRefs?.[i] ?? emptyBundle()}
                          onChange={(b) => setChunkRefs(i, b)}
                          snapTo={snapped.seconds}
                          compact={false}
                        />
                      </ChunkRefFold>
                    ))}
                  </div>
                </>
              ) : (
                <MediaBay />
              )}
            </>
          ) : (
            <MediaBay />
          )}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-4 pr-1 lg:pb-4">
        <InsetGroup header="Пресеты">
          <PresetBar bay="h3" />
        </InsetGroup>

        <InsetGroup header="Режим генерации">
          <div className="p-2">
            <Segmented
              size="sm"
              value={h3.genMode}
              onChange={setGenMode}
              options={[
                { id: "standard", label: "Standard" },
                { id: "chunks", label: "Chunks" },
              ]}
            />
          </div>
          {chunksOn ? (
            <p className="px-3.5 pb-3 text-[11px] leading-relaxed text-muted">
              Чанки генерятся по очереди. Хвост 22 кадра + звук идут в MiniMax как история
              {" "}
              <span className="font-mono text-fg">{"<Video 1>"}</span>
              {" "}· последний кадр как{" "}
              <span className="font-mono text-fg">{"<Picture 1>"}</span>
              . Склейка — наложение 2 кадров, без вырезания секунды.
            </p>
          ) : null}
        </InsetGroup>

        <InsetGroup header="Промпт">
          {chunksOn ? (
            Array.from({ length: total.n }, (_, i) => (
              <div key={i} className={i === 0 ? "" : "border-t border-line"}>
                <div className="flex items-baseline justify-between px-3.5 pt-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
                    Чанк {i + 1}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-subtle">
                    {i === 0 ? "старт" : "продолжение · Picture 1 + Video 1"}
                  </span>
                </div>
                <div className="p-2">
                  <Textarea
                    value={h3.chunkPrompts?.[i] ?? ""}
                    onChange={(e) => setChunkPrompt(i, e.target.value)}
                    placeholder={
                      i === 0
                        ? "structured prompt · <Picture 1>, shots…"
                        : "что происходит дальше · Picture 1 = last, Video 1 = хвост 22"
                    }
                    className="h-28 min-h-24 max-h-[50vh] overflow-y-auto border-0 bg-transparent px-2"
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="p-2">
              <Textarea
                value={h3.prompt}
                onChange={(e) => patch({ prompt: e.target.value })}
                placeholder="structured prompt · <Picture 1>, <Subject 1>, shots…"
                className="h-40 min-h-32 max-h-[70vh] overflow-y-auto border-0 bg-transparent px-2"
              />
            </div>
          )}
          <InsetRow label="Промпт через LLM" hint="байпас + энхансер">
            <Switch checked={h3.llm} onCheckedChange={(v) => patch({ llm: v })} />
          </InsetRow>
        </InsetGroup>

        <StylePanel
          prompt={chunksOn ? h3.chunkPrompts?.[0] || h3.prompt : h3.prompt}
          onPrompt={(prompt) => (chunksOn ? setChunkPrompt(0, prompt) : patch({ prompt }))}
          fooocus={false}
        />

        {h3.llm ? (
          <InsetGroup header="LLM · vision">
            <p className="px-3.5 pt-3 text-[11px] leading-relaxed text-muted">
              Картинка для vision — первый референс
              {chunksOn && h3.refMode === "per_chunk" ? " чанка 1" : " из Media Bay"}, если он есть.
            </p>
            <InsetRow label="Модель">
              <ModelSelect value={h3.llmModel} options={catalogs.llm} onChange={(llmModel) => patch({ llmModel })} />
            </InsetRow>
            <InsetRow label="mmproj">
              <ModelSelect value={h3.mmproj} options={catalogs.mmproj} onChange={(mmproj) => patch({ mmproj })} />
            </InsetRow>
            <InsetRow label="Reasoning">
              <ModelSelect value={h3.reasoning} options={[...REASONING]} onChange={(reasoning) => patch({ reasoning })} />
            </InsetRow>
            <InsetRow label="System prompt">
              <ModelSelect
                value={h3.systemPrompt}
                options={catalogs.systemPrompts}
                onChange={(systemPrompt) => patch({ systemPrompt })}
              />
            </InsetRow>
            <SeedRow
              label="Seed LLM"
              value={h3.seedLlm}
              onChange={(n) => patch({ seedLlm: n })}
              onRoll={() => useLab.getState().randomizeSeed("h3Llm")}
            />
          </InsetGroup>
        ) : null}

        <InsetGroup header="Настройки генерации">
          {chunksOn ? (
            <>
              <InsetRow label="Длина чанка" hint={`${snapped.seconds.toFixed(1).replace(/\.0$/, "")}с · ${snapped.frames} кадр`}>
                <span className="font-mono text-[11px] tabular-nums text-subtle">сетка 17k+5</span>
              </InsetRow>
              <div className="flex flex-wrap gap-1.5 p-2">
                {H3_CHUNK_SEC_CHIPS.map((d) => (
                  <Chip key={d} active={h3.chunkSec === d} onClick={() => patch({ chunkSec: d })}>
                    {d} с
                  </Chip>
                ))}
              </div>
              <InsetRow label="Число чанков" hint={chunkJobLabel(h3.chunkSec, h3.chunkCount)}>
                <span className="font-mono text-[11px] tabular-nums text-subtle">max 5×10с</span>
              </InsetRow>
              <div className="flex flex-wrap gap-1.5 p-2">
                {H3_CHUNK_COUNTS.map((n) => (
                  <Chip key={n} active={h3.chunkCount === n} onClick={() => patch({ chunkCount: n })}>
                    {n}
                  </Chip>
                ))}
              </div>
              <p className="px-3.5 pb-3 font-mono text-[11px] tabular-nums text-subtle">
                {total.n}×{total.seconds.toFixed(1).replace(/\.0$/, "")}с − нахлёст {total.overlap} кадр →{" "}
                {total.totalSec.toFixed(1).replace(/\.0$/, "")}с ({total.totalFrames} кадр)
              </p>
            </>
          ) : (
            <div className="flex flex-wrap gap-1.5 p-2">
              {H3_DURATIONS.map((d) => (
                <Chip key={d} active={h3.duration === d} onClick={() => patch({ duration: d })}>
                  {d} с
                </Chip>
              ))}
            </div>
          )}
          <ResolutionPicker
            ratio={h3.ratio}
            megapixels={h3.genMp ?? 0.7}
            snap={h3.snap ?? 32}
            resMode={h3.resMode ?? "preset"}
            customW={h3.customW}
            customH={h3.customH}
            customRw={h3.customRw ?? 21}
            customRh={h3.customRh ?? 9}
            mpMin={0.2}
            mpMax={2}
            mpStep={0.01}
            onChange={(p) =>
              patch({
                ...(p.ratio != null ? { ratio: p.ratio } : {}),
                ...(p.snap != null ? { snap: p.snap } : {}),
                ...(p.resMode != null ? { resMode: p.resMode } : {}),
                ...(p.customW != null ? { customW: p.customW } : {}),
                ...(p.customH != null ? { customH: p.customH } : {}),
                ...(p.customRw != null ? { customRw: p.customRw } : {}),
                ...(p.customRh != null ? { customRh: p.customRh } : {}),
                ...(p.megapixels != null ? { genMp: p.megapixels } : {}),
              })
            }
          />
          <InsetRow label="Модель MiniMax H3">
            <ModelSelect
              value={h3.unet || "h3ErosMax_beta3.safetensors"}
              options={[
                ...catalogs.unet.filter((n) => /h3|minimax/i.test(n)),
                ...catalogs.unet.filter((n) => !/h3|minimax/i.test(n)),
              ]}
              onChange={(unet) => patch({ unet })}
            />
          </InsetRow>
          <SeedRow
            label="Seed"
            value={h3.seed}
            onChange={(n) => patch({ seed: n })}
            onRoll={() => useLab.getState().randomizeSeed("h3")}
          />
          <InsetRow label="Steps">
            <NumberField value={h3.steps} min={1} max={30} digits={0} onChange={(n) => patch({ steps: Math.round(n) })} />
            <Slider min={1} max={30} step={1} value={h3.steps} onChange={(v) => patch({ steps: v })} />
          </InsetRow>
          <InsetRow label="Sampler">
            <ModelSelect value={h3.sampler} options={catalogs.samplers} onChange={(sampler) => patch({ sampler })} />
          </InsetRow>
          <InsetRow label="Scheduler">
            <ModelSelect value={h3.scheduler} options={catalogs.schedulers} onChange={(scheduler) => patch({ scheduler })} />
          </InsetRow>
        </InsetGroup>

        <InsetGroup header="LoRA">
          <LoraList
            bay="h3"
            items={h3.loras}
            onToggle={(id, on) => patch({ loras: h3.loras.map((l) => (l.id === id ? { ...l, on } : l)) })}
            onStrength={(id, strength) =>
              patch({ loras: h3.loras.map((l) => (l.id === id ? { ...l, strength } : l)) })
            }
          />
        </InsetGroup>
      </aside>
    </div>
  );
}
