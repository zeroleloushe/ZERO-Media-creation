import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Bay,
  ConnectionStatus,
  EditState,
  H3State,
  Job,
  KreaState,
  LinkInfo,
  LoraItem,
  MediaItem,
  ModelCatalog,
  NoteCard,
  CustomStyle,
  ScenePreset,
  UpscaleState,
} from "./types";
import { isBay } from "./types";
import { defaultLoraCatalog, loraLabel, LLM_MODELS, MMPROJ_MODELS, SAMPLERS, SCHEDULERS, SYSTEM_PROMPTS, UNET_MODELS } from "./presets";
import { uid as makeId } from "./utils";
import { emptyBundle } from "./h3-chunks";
import { freezeBundle, freezeMedia } from "./media";
import { DEFAULT_COMFY_URL } from "./comfy";

const EMPTY_CATALOG = (): ModelCatalog => ({
  unet: [...UNET_MODELS],
  llm: [...LLM_MODELS],
  mmproj: [...MMPROJ_MODELS],
  systemPrompts: [...SYSTEM_PROMPTS],
  samplers: [...SAMPLERS],
  schedulers: [...SCHEDULERS],
  upscaleModels: [
    "minimax_h3_latent_upscaler_3d_bf16.safetensors",
    "ltx-2.3-spatial-upscaler-x2-1.1.safetensors",
    "ltx-2.3-spatial-upscaler-x1.5-1.0.safetensors",
  ],
});

function randSeed() {
  return Math.floor(Math.random() * 9_999_999);
}

function durableUrl(u: unknown): string | null {
  if (typeof u !== "string" || u.length < 4) return null;
  if (u.startsWith("blob:")) return null;
  return u;
}

const defaultH3 = (): H3State => ({
  prompt: "",
  llm: false,
  duration: 10,
  ratio: "21:9",
  customW: 1280,
  customH: 544,
  customRw: 21,
  customRh: 9,
  genMp: 0.7,
  snap: 32,
  resMode: "preset",
  seed: 2279279,
  loras: [],
  audioFromPixaroma: false,
  pixaromaAudio: null,
  pictures: [],
  videos: [],
  audios: [],
  upscale: false,
  denoise: 0.25,
  megapixels: 1.8,
  upscaleRatio: "21:9",
  upscaleSnap: 32,
  chunks: 2,
  upscaleModel: "minimax_h3_latent_upscaler_3d_bf16.safetensors",
  steps: 8,
  sampler: "er_sde",
  scheduler: "beta",
  unet: "h3ErosMax_beta3.safetensors",
  llmModel: "Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf",
  mmproj: "Huihui-Qwen3.5-9B-abliterated.mmproj-Q8_0.gguf",
  reasoning: "off",
  systemPrompt: "Zero - ImagePromt 18 test.txt",
  seedLlm: 19712,
  genMode: "standard",
  chunkSec: 8,
  chunkCount: 3,
  chunkPrompts: ["", "", "", "", ""],
  refMode: "shared",
  chunkRefs: [emptyBundle(), emptyBundle(), emptyBundle(), emptyBundle(), emptyBundle()],
});

const defaultUpscale = (): UpscaleState => ({
  prompt:
    "Restore and enhance this video. Sharpen fine details, clean textures, stabilize faces, hands and identity. Keep original motion, lighting, color and composition. Natural skin, no morphing, no extra limbs, no text, no watermark. High-end cinematic grade, subtle film grain.",
  source: null,
  pictures: [],
  megapixels: 1.8,
  snap: 32,
  chunks: 4,
  denoise: 0.25,
  steps: 4,
  sampler: "euler",
  scheduler: "beta",
  seed: 8719838,
  unet: "h3ErosMax_beta3.safetensors",
  upscaleModel: "minimax_h3_latent_upscaler_3d_bf16.safetensors",
  loras: [],
});

const defaultKrea = (): KreaState => ({
  prompt: "",
  extraPrompt: "motion lines, motion blur, bloom, subsurface scattering, ",
  triggerWords: "tooncore, @prettycake, gradeXniji_style, gpt2, m1V8, masterpiece, very aesthetic",
  llmEnhance: false,
  triggerOn: false,
  extraOn: false,
  loraOn: false,
  styleOn: false,
  styleId: "prettycake",
  styleIds: [],
  reasoning: "off",
  systemPrompt: "Zero - ImagePromt 18 test.txt",
  llmModel: "Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf",
  mmproj: "Huihui-Qwen3.5-9B-abliterated.mmproj-Q8_0.gguf",
  unet: "krea2_turbo_int8_convrot.safetensors",
  steps: 10,
  sampler: "er_sde",
  scheduler: "simple",
  seedImage: 78748,
  seedLlm: 19712,
  ratio: "2:3",
  customW: 1152,
  customH: 1728,
  customRw: 2,
  customRh: 3,
  megapixels: 2,
  snap: 64,
  resMode: "preset",
  upscale: false,
  denoise: 0.28,
  upscaleBy: 2,
  upscaleMp: 6,
  upscaleSnap: 16,
  loadImage: null,
  loras: [],
});

const defaultEdit = (): EditState => ({
  prompt:
    "Use the reference image only to extract the character identity.\n\nThe reference contains multiple views of ONE character. These views are NOT part of the final image.\n\nGenerate a new image with ONLY ONE character.\nKeep the exact same face, hairstyle, outfit, body proportions and details from the reference.\n\nCreate the following scene:\n\nThe girl goes in the middle of a dark fantasy castle, with gloomy lighting. A shot from a film, teleobjective, motion blur, graininess, cinematic shot.",
  preset: "custom",
  matchSource: false,
  ratio: "9:16",
  customW: 768,
  customH: 1280,
  customRw: 9,
  customRh: 16,
  megapixels: 1,
  snap: 64,
  resMode: "preset",
  seed: 11746,
  styleOn: false,
  styleId: "none",
  styleIds: [],
  upscale: false,
  denoise: 0.2,
  upscaleBy: 2,
  image1: null,
  image2: null,
  loras: [],
});

function stripH3(h: H3State) {
  const { pictures: _p, videos: _v, audios: _a, pixaromaAudio: _x, ...rest } = h;
  return rest;
}
function stripKrea(k: KreaState) {
  const { loadImage: _i, ...rest } = k;
  return rest;
}
function stripEdit(e: EditState) {
  const { image1: _a, image2: _b, ...rest } = e;
  return rest;
}
function stripUpscale(u: UpscaleState) {
  const { source: _s, pictures: _p, ...rest } = u;
  return rest;
}

interface LabState {
  bay: Bay;
  comfyUrl: string;
  connection: ConnectionStatus;
  linkInfo: LinkInfo;
  h3: H3State;
  krea: KreaState;
  edit: EditState;
  upscale: UpscaleState;
  jobs: Job[];
  runningId: string | null;
  elapsedMs: number;
  previewH3: string | null;
  previewKrea: string | null;
  previewEdit: string | null;
  previewUpscale: string | null;
  compareEdit: string | null;
  liveFrame: string | null;
  liveFrames: string[];
  liveHint: string;
  liveProgress: number;
  liveMime: string | null;
  liveFps: number;
  liveTick: number;
  scenePresets: ScenePreset[];
  notes: NoteCard[];
  customStyles: CustomStyle[];
  activePreset: Record<Bay, string | null>;
  availableLoras: string[];
  catalogs: ModelCatalog;
  compareOn: boolean;
  setBay: (bay: Bay) => void;
  setComfyUrl: (url: string) => void;
  setConnection: (s: ConnectionStatus, info?: LinkInfo) => void;
  patchH3: (p: Partial<H3State>) => void;
  patchKrea: (p: Partial<KreaState>) => void;
  patchEdit: (p: Partial<EditState>) => void;
  patchUpscale: (p: Partial<UpscaleState>) => void;
  addMedia: (slot: "pictures" | "videos" | "audios", item: MediaItem) => void;
  updateMedia: (slot: "pictures" | "videos" | "audios", id: string, patch: Partial<MediaItem>) => void;
  removeMedia: (slot: "pictures" | "videos" | "audios", id: string) => void;
  moveMedia: (slot: "pictures" | "videos" | "audios", from: number, to: number) => void;
  setEditImage: (which: "image1" | "image2" | "loadImage", item: MediaItem | null) => void;
  updateEditImage: (which: "image1" | "image2" | "loadImage", patch: Partial<MediaItem>) => void;
  randomizeSeed: (target: "h3" | "h3Llm" | "kreaImage" | "kreaLlm" | "edit" | "upscale") => void;
  pushJob: (job: Job) => void;
  patchJob: (id: string, patch: Partial<Job>) => void;
  setRunning: (id: string | null) => void;
  setElapsed: (ms: number) => void;
  setPreview: (bay: Bay, url: string | null, compare?: string | null) => void;
  setLive: (patch: {
    frame?: string | null;
    hint?: string;
    progress?: number;
    append?: boolean;
    mime?: string;
    fps?: number;
  }) => void;
  clearJobs: () => void;
  setAvailableLoras: (files: string[]) => void;
  setCatalogs: (c: Partial<ModelCatalog>) => void;
  setCompareOn: (on: boolean) => void;
  addLora: (bay: Bay, file: string) => void;
  removeLora: (bay: Bay, id: string) => void;
  patchLora: (bay: Bay, id: string, patch: Partial<LoraItem>) => void;
  applyPreset: (id: string) => void;
  savePreset: (bay: Bay, name: string) => void;
  deletePreset: (id: string) => void;
  addNote: (title: string, body: string) => void;
  updateNote: (id: string, patch: Partial<NoteCard>) => void;
  deleteNote: (id: string) => void;
  addStyle: (name: string, prompt: string) => void;
  deleteStyle: (id: string) => void;
}

export const useLab = create<LabState>()(
  persist(
    (set, get) => ({
      bay: "h3",
      comfyUrl: DEFAULT_COMFY_URL,
      connection: "demo",
      linkInfo: {},
      h3: defaultH3(),
      krea: defaultKrea(),
      edit: defaultEdit(),
      upscale: defaultUpscale(),
      jobs: [],
      runningId: null,
      elapsedMs: 0,
      previewH3: null,
      previewKrea: null,
      previewEdit: null,
      previewUpscale: null,
      compareEdit: null,
      liveFrame: null,
      liveFrames: [],
      liveHint: "",
      liveProgress: 0,
      liveMime: null,
      liveFps: 10,
      liveTick: 0,
      scenePresets: [],
      notes: [],
      customStyles: [],
      activePreset: { h3: null, krea: null, edit: null, upscale: null },
      availableLoras: defaultLoraCatalog(),
      catalogs: EMPTY_CATALOG(),
      compareOn: false,
      setBay: (bay) => set({ bay }),
      setComfyUrl: (comfyUrl) => set({ comfyUrl }),
      setConnection: (connection, linkInfo) => set({ connection, linkInfo: linkInfo ?? get().linkInfo }),
      patchH3: (p) => set({ h3: { ...get().h3, ...p } }),
      patchKrea: (p) => set({ krea: { ...get().krea, ...p } }),
      patchEdit: (p) => set({ edit: { ...get().edit, ...p } }),
      patchUpscale: (p) => set({ upscale: { ...get().upscale, ...p } }),
      addMedia: (slot, item) => {
        const h3 = { ...get().h3 };
        const cap = slot === "pictures" ? 9 : 3;
        h3[slot] = [...h3[slot], item].slice(0, cap);
        set({ h3 });
      },
      updateMedia: (slot, id, patch) => {
        const h3 = { ...get().h3 };
        h3[slot] = h3[slot].map((m) => (m.id === id ? { ...m, ...patch } : m));
        set({ h3 });
      },
      removeMedia: (slot, id) => {
        const h3 = { ...get().h3 };
        h3[slot] = h3[slot].filter((m) => m.id !== id);
        set({ h3 });
      },
      moveMedia: (slot, from, to) => {
        const list = [...get().h3[slot]];
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
        set({ h3: { ...get().h3, [slot]: list } });
      },
      setEditImage: (which, item) => {
        if (which === "loadImage") set({ krea: { ...get().krea, loadImage: item } });
        else set({ edit: { ...get().edit, [which]: item } });
      },
      updateEditImage: (which, patch) => {
        if (which === "loadImage") {
          const cur = get().krea.loadImage;
          if (!cur) return;
          set({ krea: { ...get().krea, loadImage: { ...cur, ...patch } } });
        } else {
          const cur = get().edit[which];
          if (!cur) return;
          set({ edit: { ...get().edit, [which]: { ...cur, ...patch } } });
        }
      },
      randomizeSeed: (target) => {
        if (target === "h3") set({ h3: { ...get().h3, seed: randSeed() } });
        if (target === "h3Llm") set({ h3: { ...get().h3, seedLlm: randSeed() } });
        if (target === "kreaImage") set({ krea: { ...get().krea, seedImage: randSeed() } });
        if (target === "kreaLlm") set({ krea: { ...get().krea, seedLlm: randSeed() } });
        if (target === "edit") set({ edit: { ...get().edit, seed: randSeed() } });
        if (target === "upscale") set({ upscale: { ...get().upscale, seed: randSeed() } });
      },
      pushJob: (job) => set({ jobs: [job, ...get().jobs].slice(0, 24) }),
      patchJob: (id, patch) =>
        set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }),
      setRunning: (runningId) => set({ runningId }),
      setElapsed: (elapsedMs) => set({ elapsedMs }),
      setPreview: (bay, url, compare) => {
        if (bay === "h3") set({ previewH3: url });
        if (bay === "krea") set({ previewKrea: url });
        if (bay === "edit") set({ previewEdit: url, compareEdit: compare ?? get().compareEdit });
        if (bay === "upscale") set({ previewUpscale: url });
      },
      setLive: ({ frame, hint, progress, append, mime, fps }) =>
        set((s) => {
          const keep = new Set(
            [s.previewH3, s.previewKrea, s.previewEdit, s.previewUpscale, ...s.jobs.map((j) => j.resultUrl)].filter(
              (u): u is string => Boolean(u),
            ),
          );
          const drop = (u: string) => {
            if (!u.startsWith("blob:") || keep.has(u)) return;
            URL.revokeObjectURL(u);
          };
          let liveFrame = s.liveFrame;
          let liveFrames = s.liveFrames;
          let liveMime = s.liveMime;
          let liveFps = s.liveFps;
          let liveTick = s.liveTick;
          if (frame === null) {
            for (const u of liveFrames) drop(u);
            if (liveFrame && !liveFrames.includes(liveFrame)) drop(liveFrame);
            liveFrame = null;
            liveFrames = [];
            liveMime = null;
            liveTick = 0;
          } else if (frame) {
            if (append) {
              liveFrames = [...liveFrames, frame];
              if (liveFrames.length > 240) {
                const dropped = liveFrames.splice(0, liveFrames.length - 240);
                for (const u of dropped) drop(u);
              }
              liveFrame = frame;
              liveTick += 1;
            } else {
              const dying = liveFrames.filter((u) => u !== frame);
              if (liveFrame && liveFrame !== frame && !dying.includes(liveFrame)) dying.push(liveFrame);
              liveFrame = frame;
              liveFrames = [frame];
              liveTick += 1;
              if (dying.length) {
                window.setTimeout(() => {
                  for (const u of dying) drop(u);
                }, 1500);
              }
            }
            if (mime) liveMime = mime;
            if (fps && fps > 0) liveFps = fps;
          }
          let liveProgress = s.liveProgress;
          if (progress != null) {
            if (progress <= 0) liveProgress = 0;
            else if (progress >= 100) liveProgress = 100;
            else liveProgress = Math.max(s.liveProgress, progress);
          }
          return {
            liveFrame,
            liveFrames,
            liveMime,
            liveFps,
            liveTick,
            ...(hint != null ? { liveHint: hint } : {}),
            liveProgress,
          };
        }),
      clearJobs: () => set({ jobs: [] }),
      setAvailableLoras: (files) => {
        set({ availableLoras: files.length ? [...files].sort((a, b) => a.localeCompare(b, "en")) : defaultLoraCatalog() });
      },
      setCatalogs: (c) => set({ catalogs: { ...get().catalogs, ...c } }),
      setCompareOn: (compareOn) => set({ compareOn }),
      addLora: (bay, file) => {
        const item: LoraItem = {
          id: file,
          name: loraLabel(file),
          file,
          on: true,
          strength: 0.8,
        };
        if (bay === "h3") {
          if (get().h3.loras.some((l) => l.file === file)) return;
          set({ h3: { ...get().h3, loras: [...get().h3.loras, item] } });
        } else if (bay === "krea") {
          if (get().krea.loras.some((l) => l.file === file)) return;
          set({ krea: { ...get().krea, loras: [...get().krea.loras, item], loraOn: true } });
        } else if (bay === "upscale") {
          if (get().upscale.loras.some((l) => l.file === file)) return;
          set({ upscale: { ...get().upscale, loras: [...get().upscale.loras, item] } });
        } else {
          if (get().edit.loras.some((l) => l.file === file)) return;
          set({ edit: { ...get().edit, loras: [...get().edit.loras, item] } });
        }
      },
      removeLora: (bay, id) => {
        const keep = (l: LoraItem) => l.hidden || l.id !== id;
        if (bay === "h3") set({ h3: { ...get().h3, loras: get().h3.loras.filter(keep) } });
        else if (bay === "krea") set({ krea: { ...get().krea, loras: get().krea.loras.filter(keep) } });
        else if (bay === "upscale") set({ upscale: { ...get().upscale, loras: get().upscale.loras.filter(keep) } });
        else set({ edit: { ...get().edit, loras: get().edit.loras.filter(keep) } });
      },
      patchLora: (bay, id, patch) => {
        const map = (list: LoraItem[]) => list.map((l) => (l.id === id ? { ...l, ...patch } : l));
        if (bay === "h3") set({ h3: { ...get().h3, loras: map(get().h3.loras) } });
        else if (bay === "krea") set({ krea: { ...get().krea, loras: map(get().krea.loras) } });
        else if (bay === "upscale") set({ upscale: { ...get().upscale, loras: map(get().upscale.loras) } });
        else set({ edit: { ...get().edit, loras: map(get().edit.loras) } });
      },
      applyPreset: (id) => {
        const preset = get().scenePresets.find((p) => p.id === id);
        if (!preset) return;
        const payload = preset.payload;
        if (preset.bay === "h3") {
          const h3 = get().h3;
          set({
            h3: {
              ...h3,
              ...payload,
              pictures: h3.pictures,
              videos: h3.videos,
              audios: h3.audios,
              pixaromaAudio: null,
              audioFromPixaroma: false,
            } as H3State,
            activePreset: { ...get().activePreset, h3: id },
          });
        } else if (preset.bay === "krea") {
          const krea = get().krea;
          set({
            krea: { ...krea, ...payload, loadImage: krea.loadImage } as KreaState,
            activePreset: { ...get().activePreset, krea: id },
          });
        } else if (preset.bay === "upscale") {
          const up = get().upscale;
          set({
            upscale: { ...up, ...payload, source: up.source, pictures: up.pictures } as UpscaleState,
            activePreset: { ...get().activePreset, upscale: id },
          });
        } else {
          const edit = get().edit;
          set({
            edit: { ...edit, ...payload, image1: edit.image1, image2: edit.image2 } as EditState,
            activePreset: { ...get().activePreset, edit: id },
          });
        }
      },
      savePreset: (bay, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const payload =
          bay === "h3"
            ? stripH3(get().h3)
            : bay === "krea"
              ? stripKrea(get().krea)
              : bay === "upscale"
                ? stripUpscale(get().upscale)
                : stripEdit(get().edit);
        const existing = get().scenePresets.find((p) => p.bay === bay && p.name === trimmed);
        const preset: ScenePreset = {
          id: existing?.id ?? makeId("preset"),
          bay,
          name: trimmed,
          payload,
        };
        const scenePresets = existing
          ? get().scenePresets.map((p) => (p.id === existing.id ? preset : p))
          : [preset, ...get().scenePresets];
        set({ scenePresets, activePreset: { ...get().activePreset, [bay]: preset.id } });
      },
      deletePreset: (id) => {
        const scenePresets = get().scenePresets.filter((p) => p.id !== id);
        const activePreset = { ...get().activePreset };
        (Object.keys(activePreset) as Bay[]).forEach((b) => {
          if (activePreset[b] === id) activePreset[b] = null;
        });
        set({ scenePresets, activePreset });
      },
      addNote: (title, body) =>
        set({
          notes: [{ id: makeId("note"), title, body, createdAt: Date.now() }, ...get().notes],
        }),
      updateNote: (id, patch) =>
        set({ notes: get().notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }),
      deleteNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),
      addStyle: (name, prompt) =>
        set({
          customStyles: [
            { id: makeId("style"), name, prompt, custom: true },
            ...get().customStyles,
          ],
        }),
      deleteStyle: (id) => set({ customStyles: get().customStyles.filter((s) => s.id !== id) }),
    }),
    {
      name: "seamless-lab",
      version: 5,
      skipHydration: true,
      migrate: (persisted, version) => {
        const p = persisted as Partial<LabState>;
        if (version < 5) {
          return {
            ...p,
            h3: p.h3
              ? {
                  ...p.h3,
                  loras: version < 3 ? [] : p.h3.loras,
                  unet: p.h3.unet || "h3ErosMax_beta3.safetensors",
                }
              : p.h3,
            krea: p.krea
              ? {
                  ...p.krea,
                  loras: version < 3 ? [] : p.krea.loras,
                  llmEnhance: version < 4 ? false : p.krea.llmEnhance,
                  triggerOn: version < 4 ? false : p.krea.triggerOn,
                  extraOn: version < 4 ? false : p.krea.extraOn,
                  denoise: p.krea.denoise ?? 0.28,
                  upscaleBy: p.krea.upscaleBy ?? 2,
                  upscaleMp: p.krea.upscaleMp ?? 6,
                  upscaleSnap: p.krea.upscaleSnap ?? 16,
                }
              : p.krea,
            edit: p.edit ? { ...p.edit, loras: version < 3 ? [] : p.edit.loras } : p.edit,
          };
        }
        return p;
      },
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (s) => ({
        bay: s.bay,
        comfyUrl: s.comfyUrl,
        h3: {
          ...s.h3,
          pictures: s.h3.pictures.map(freezeMedia),
          videos: s.h3.videos.map(freezeMedia),
          audios: s.h3.audios.map(freezeMedia),
          pixaromaAudio: null,
          audioFromPixaroma: false,
          chunkRefs: (s.h3.chunkRefs ?? []).map(freezeBundle),
        },
        krea: { ...s.krea, loadImage: s.krea.loadImage ? freezeMedia(s.krea.loadImage) : null },
        edit: {
          ...s.edit,
          image1: s.edit.image1 ? freezeMedia(s.edit.image1) : null,
          image2: s.edit.image2 ? freezeMedia(s.edit.image2) : null,
        },
        upscale: {
          ...s.upscale,
          source: s.upscale.source ? freezeMedia(s.upscale.source) : null,
          pictures: s.upscale.pictures.map(freezeMedia),
        },
        jobs: s.jobs
          .filter((j) => j.status === "done" || j.status === "error")
          .slice(0, 80)
          .map((j) => ({
            ...j,
            resultUrl: durableUrl(j.resultUrl) ?? "",
            thumb: durableUrl(j.thumb) ?? "",
          })),
        previewH3: durableUrl(s.previewH3),
        previewKrea: durableUrl(s.previewKrea),
        previewEdit: durableUrl(s.previewEdit),
        previewUpscale: durableUrl(s.previewUpscale),
        scenePresets: s.scenePresets,
        activePreset: s.activePreset,
        notes: s.notes,
        customStyles: s.customStyles,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current;
        const p = persisted as Partial<LabState> & { version?: number };
        return {
          ...current,
          ...p,
          bay: isBay(p.bay) ? p.bay : current.bay,
          comfyUrl: (typeof p.comfyUrl === "string" && p.comfyUrl.trim()) || current.comfyUrl,
          h3: {
            ...current.h3,
            ...(p.h3 ?? {}),
            unet: (p.h3 as H3State | undefined)?.unet || current.h3.unet,
            upscaleModel:
              (p.h3 as H3State | undefined)?.upscaleModel || current.h3.upscaleModel,
            pictures: Array.isArray((p.h3 as H3State | undefined)?.pictures)
              ? (p.h3 as H3State).pictures
              : current.h3.pictures,
            videos: Array.isArray((p.h3 as H3State | undefined)?.videos)
              ? (p.h3 as H3State).videos
              : current.h3.videos,
            audios: Array.isArray((p.h3 as H3State | undefined)?.audios)
              ? (p.h3 as H3State).audios
              : current.h3.audios,
            pixaromaAudio: null,
            audioFromPixaroma: false,
            genMode: (p.h3 as H3State | undefined)?.genMode ?? current.h3.genMode,
            chunkSec: (p.h3 as H3State | undefined)?.chunkSec ?? current.h3.chunkSec,
            chunkCount: (p.h3 as H3State | undefined)?.chunkCount ?? current.h3.chunkCount,
            chunkPrompts: (() => {
              const raw = (p.h3 as H3State | undefined)?.chunkPrompts ?? current.h3.chunkPrompts;
              const arr = Array.isArray(raw) ? [...raw] : ["", "", "", "", ""];
              while (arr.length < 5) arr.push("");
              return arr.slice(0, 5);
            })(),
            refMode: (p.h3 as H3State | undefined)?.refMode ?? current.h3.refMode,
            chunkRefs: Array.isArray((p.h3 as H3State | undefined)?.chunkRefs)
              ? (p.h3 as H3State).chunkRefs
              : current.h3.chunkRefs,
          },
          krea: {
            ...current.krea,
            ...(p.krea ?? {}),
            denoise: (p.krea as KreaState | undefined)?.denoise ?? current.krea.denoise,
            upscaleBy: (p.krea as KreaState | undefined)?.upscaleBy ?? current.krea.upscaleBy,
            upscaleMp: (p.krea as KreaState | undefined)?.upscaleMp ?? current.krea.upscaleMp,
            upscaleSnap: (p.krea as KreaState | undefined)?.upscaleSnap ?? current.krea.upscaleSnap,
            loadImage: (p.krea as KreaState | undefined)?.loadImage ?? current.krea.loadImage,
          },
          edit: {
            ...current.edit,
            ...(p.edit ?? {}),
            image1: (p.edit as EditState | undefined)?.image1 ?? current.edit.image1,
            image2: (p.edit as EditState | undefined)?.image2 ?? current.edit.image2,
          },
          upscale: {
            ...current.upscale,
            ...(p.upscale ?? {}),
            source: (p.upscale as UpscaleState | undefined)?.source ?? current.upscale.source,
            pictures: Array.isArray((p.upscale as UpscaleState | undefined)?.pictures)
              ? (p.upscale as UpscaleState).pictures
              : current.upscale.pictures,
          },
          availableLoras: current.availableLoras,
          catalogs: current.catalogs,
          scenePresets: (() => {
            const map = new Map<string, ScenePreset>();
            for (const x of current.scenePresets ?? []) map.set(x.id, x);
            for (const x of p.scenePresets ?? []) map.set(x.id, x);
            return [...map.values()].filter((x) => !x.builtin);
          })(),
          activePreset: { ...current.activePreset, ...(p.activePreset ?? {}) },
          notes: Array.isArray(p.notes) ? p.notes : current.notes,
          customStyles: Array.isArray(p.customStyles) ? p.customStyles : current.customStyles,
          compareOn: false,
          previewH3: durableUrl(p.previewH3),
          previewKrea: durableUrl(p.previewKrea),
          previewEdit: durableUrl(p.previewEdit),
          previewUpscale: durableUrl(p.previewUpscale),
          jobs: Array.isArray(p.jobs)
            ? p.jobs.map((j) => ({
                ...j,
                resultUrl: durableUrl(j.resultUrl) ?? "",
                thumb: durableUrl(j.thumb) ?? "",
              }))
            : current.jobs,
        };
      },
    },
  ),
);

export { makeId, randSeed };
