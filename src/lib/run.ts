import { toast } from "sonner";
import { buildEditGraph, buildH3Graph, buildH3LatentUpscaleGraph, buildKreaGraph, buildUpscaleGraph, composeKreaPrompt } from "./export-workflow";
import {
  pingComfy,
  queuePrompt,
  fetchComfyLoras,
  fetchComfyCatalog,
  interruptPrompt,
  uploadToComfy,
  waitForPrompt,
  pickOutput,
  fetchViewBlob,
} from "./comfy";
import { openComfySocket } from "./comfy-socket";
import { putGalleryBlob } from "./gallery-db";
import { useLab } from "./store";
import { allH3Media, chunkJobLabel, joinedChunkPrompt } from "./h3-chunks";
import { uid } from "./utils";
import type { Bay, Job, MediaItem } from "./types";

const DEMO: Record<Bay, { url: string; kind: "image" | "video"; thumb: string }> = {
  h3: { url: "/demo/h3-demo.mp4", kind: "video", thumb: "/demo/h3-still.jpg" },
  krea: { url: "/demo/krea-still.jpg", kind: "image", thumb: "/demo/krea-still.jpg" },
  edit: { url: "/demo/edit-result.jpg", kind: "image", thumb: "/demo/edit-result.jpg" },
  upscale: { url: "/demo/h3-demo.mp4", kind: "video", thumb: "/demo/h3-still.jpg" },
};

function currentPrompt(bay: Bay) {
  const s = useLab.getState();
  if (bay === "h3") return joinedChunkPrompt(s.h3);
  if (bay === "krea") return composeKreaPrompt(s.krea);
  if (bay === "upscale") return s.upscale.prompt;
  return s.edit.prompt;
}

function currentSeed(bay: Bay) {
  const s = useLab.getState();
  if (bay === "h3") return s.h3.seed;
  if (bay === "krea") return s.krea.seedImage;
  if (bay === "upscale") return s.upscale.seed;
  return s.edit.seed;
}

export async function exportCurrent(bay: Bay) {
  const s = useLab.getState();
  if (bay === "h3") return buildH3Graph(s.h3);
  if (bay === "krea") return buildKreaGraph(s.krea);
  if (bay === "upscale") {
    if (s.upscale.useH3Latent) return buildH3LatentUpscaleGraph(s.h3, s.upscale);
    return buildUpscaleGraph(s.upscale);
  }
  return buildEditGraph(s.edit);
}

async function blobOf(item: MediaItem) {
  const src = item.croppedUrl || item.url;
  const res = await fetch(src);
  return res.blob();
}

async function uploadItem(comfyUrl: string, item: MediaItem) {
  const blob = await blobOf(item);
  const name = await uploadToComfy(comfyUrl, blob, item.name || "upload.png");
  return name;
}

async function prepareUploads(bay: Bay, comfyUrl: string) {
  const s = useLab.getState();
  if (bay === "krea") {
    if (s.krea.llmEnhance) {
      if (s.krea.loadImage) {
        const name = await uploadItem(comfyUrl, s.krea.loadImage);
        s.patchKrea({ loadImage: { ...s.krea.loadImage, name } });
      } else {
        const blank = await fetch("/demo/blank.png").then((r) => r.blob());
        const name = await uploadToComfy(comfyUrl, blank, "seamless-blank.png");
        s.patchKrea({
          loadImage: {
            id: "blank",
            kind: "picture",
            name,
            url: "/demo/blank.png",
            mime: "image/png",
            trimStart: 0,
            trimLength: 0,
          },
        });
      }
    }
  }
  if (bay === "edit") {
    if (!s.edit.image1) throw new Error("Загрузи изображение 1");
    const name = await uploadItem(comfyUrl, s.edit.image1);
    s.patchEdit({ image1: { ...s.edit.image1, name } });
    if (s.edit.image2) {
      const n2 = await uploadItem(comfyUrl, s.edit.image2);
      s.patchEdit({ image2: { ...s.edit.image2, name: n2 } });
    }
  }
  if (bay === "h3" || (bay === "upscale" && s.upscale.useH3Latent)) {
    const h = s.h3;
    const seen = new Set<string>();
    const items = [...h.pictures, ...h.videos, ...h.audios, ...allH3Media(h)];
    const unique = items.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    const uploaded = await Promise.all(
      unique.map(async (p) => {
        try {
          return { ...p, name: await uploadItem(comfyUrl, p) };
        } catch {
          return p;
        }
      }),
    );
    const byId = new Map(uploaded.map((p) => [p.id, p]));
    const remap = (list: typeof h.pictures) => list.map((p) => byId.get(p.id) ?? p);
    const pictures = remap(h.pictures);
    const videos = remap(h.videos);
    const audios = remap(h.audios);
    const chunkRefs = (h.chunkRefs ?? []).map((b) => ({
      pictures: remap(b.pictures),
      videos: remap(b.videos),
      audios: remap(b.audios),
    }));
    s.patchH3({ pictures, videos, audios, chunkRefs });
  }
  if (bay === "upscale" && !s.upscale.useH3Latent) {
    const u = s.upscale;
    if (!u.source) throw new Error("Загрузи видео");
    const source = { ...u.source, name: await uploadItem(comfyUrl, u.source) };
    const pictures = await Promise.all(
      u.pictures.map(async (p) => ({ ...p, name: await uploadItem(comfyUrl, p) })),
    );
    s.patchUpscale({ source, pictures });
  }
}

let runAbort: AbortController | null = null;

export async function sendVideoToUpscale(url: string, name = "source.mp4") {
  const item: MediaItem = {
    id: uid("video"),
    kind: "video",
    name,
    url,
    mime: "video/mp4",
    trimStart: 0,
    trimLength: 0,
  };
  try {
    const v = document.createElement("video");
    v.preload = "metadata";
    await new Promise<void>((resolve) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => resolve();
      v.src = url;
    });
    item.width = v.videoWidth || undefined;
    item.height = v.videoHeight || undefined;
    item.duration = Number.isFinite(v.duration) ? v.duration : undefined;
    item.trimLength = item.duration || 0;
    v.src = "";
  } catch {
    /* keep */
  }
  const s = useLab.getState();
  s.patchUpscale({ source: item });
  s.setPreview("upscale", url);
  s.setBay("upscale");
  toast("Видео в апскейле");
}

export async function sendH3ToLatentUpscale() {
  const s = useLab.getState();
  const url = s.previewH3;
  if (!url) {
    toast.error("Сначала сгенерируй ролик");
    return;
  }
  const item: MediaItem = {
    id: uid("video"),
    kind: "video",
    name: "h3-pass.mp4",
    url,
    mime: "video/mp4",
    trimStart: 0,
    trimLength: 0,
  };
  try {
    const v = document.createElement("video");
    v.preload = "metadata";
    await new Promise<void>((resolve) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => resolve();
      v.src = url;
    });
    item.width = v.videoWidth || undefined;
    item.height = v.videoHeight || undefined;
    item.duration = Number.isFinite(v.duration) ? v.duration : undefined;
    item.trimLength = item.duration || 0;
    v.src = "";
  } catch {
    /* keep */
  }
  const fromChunks = s.h3.genMode === "chunks";
  s.patchUpscale({
    source: item,
    pictures: s.h3.pictures,
    loras: s.h3.loras,
    unet: s.h3.unet,
    useH3Latent: !fromChunks,
  });
  s.setPreview("upscale", url);
  s.setBay("upscale");
  toast(fromChunks ? "Склейка чанков → апскейл с encode" : "Апскейл от латента H3");
  void runBay("upscale");
}

export async function interruptBay() {
  const s = useLab.getState();
  runAbort?.abort();
  if (s.connection === "online" && s.comfyUrl) {
    try {
      await interruptPrompt(s.comfyUrl);
    } catch {
      /* ignore */
    }
  }
  if (s.runningId) {
    s.patchJob(s.runningId, { status: "interrupted", progress: 0, note: "Прервано" });
    s.setRunning(null);
  }
  s.setLive({ frame: null, hint: "", progress: 0 });
  toast("Остановлено");
}

export async function runBay(bay: Bay, opts?: { upscale?: boolean }) {
  const s0 = useLab.getState();
  if (s0.runningId) {
    toast("Уже идёт прогон");
    return;
  }
  const wantUpscale = Boolean(opts?.upscale);
  if (wantUpscale) {
    if (bay === "edit") s0.patchEdit({ upscale: true });
    if (bay === "h3") s0.patchH3({ upscale: true });
    if (bay === "krea") s0.patchKrea({ upscale: true });
  } else {
    if (bay === "edit") s0.patchEdit({ upscale: false });
    if (bay === "h3") s0.patchH3({ upscale: false });
    if (bay === "krea") s0.patchKrea({ upscale: false });
  }

  const s = useLab.getState();
  if (bay === "krea" && !composeKreaPrompt(s.krea).trim()) {
    toast.error("Напиши промпт");
    return;
  }
  if (bay === "edit" && !s.edit.image1) {
    toast.error("Загрузи изображение 1");
    return;
  }
  if (bay === "upscale" && !s.upscale.source) {
    toast.error("Загрузи видео для апскейла");
    return;
  }

  const demo = DEMO[bay];
  const job: Job = {
    id: uid("job"),
    bay,
    createdAt: Date.now(),
    durationMs: 0,
    thumb: demo.thumb,
    resultUrl: demo.url,
    kind: demo.kind,
    seed: currentSeed(bay),
    prompt: currentPrompt(bay),
    status: "running",
    progress: 4,
    note: wantUpscale
      ? "Апскейл"
      : s.connection === "online"
        ? bay === "h3" && s.h3.genMode === "chunks"
          ? `Chunks · ${chunkJobLabel(s.h3.chunkSec, s.h3.chunkCount)}`
          : "ComfyUI"
        : "Демо",
    upscale: wantUpscale,
    ratio: bay === "h3" ? s.h3.ratio : bay === "krea" ? s.krea.ratio : bay === "upscale" ? "video" : s.edit.ratio,
    steps: bay === "krea" ? s.krea.steps : bay === "h3" ? s.h3.steps : bay === "upscale" ? s.upscale.steps : undefined,
    unet: bay === "krea" ? s.krea.unet : bay === "h3" ? s.h3.unet : bay === "upscale" ? s.upscale.unet : undefined,
  };
  s.pushJob(job);
  s.setRunning(job.id);
  s.setElapsed(0);
  const t0 = Date.now();
  const tick = window.setInterval(() => {
    useLab.getState().setElapsed(Date.now() - t0);
  }, 80);
  runAbort = new AbortController();

  try {
    if (s.connection === "online" && s.comfyUrl) {
      useLab.getState().setLive({ frame: null, hint: "waiting for sample…", progress: 4 });
      const socket = openComfySocket(s.comfyUrl, job.id, {
        onPreview: (blob, meta) => {
          const url = URL.createObjectURL(blob);
          const mime = meta?.mime || blob.type || "image/jpeg";
          useLab.getState().setLive({
            frame: url,
            append: false,
            mime,
            fps: meta?.fps,
          });
        },
        onProgress: (value, max) => {
          const pct = max ? Math.round((value / max) * 100) : 0;
          const prev = useLab.getState().liveProgress;
          const next = pct <= 0 ? prev : Math.max(prev, pct);
          useLab.getState().setLive({ hint: `${value}/${max}`, progress: next });
          useLab.getState().patchJob(job.id, { progress: next });
        },
        onStatus: (text) => {
          const cur = useLab.getState().liveHint;
          if (/^\d+\s*\/\s*\d+/.test(cur)) return;
          useLab.getState().setLive({ hint: text });
        },
        onError: (message) => toast.error(message),
      });
      try {
        await Promise.race([socket.ready, new Promise((r) => setTimeout(r, 1800))]);
        await prepareUploads(bay, s.comfyUrl);
        const graph = await exportCurrent(bay);
        const queued = await queuePrompt(s.comfyUrl, graph, job.id);
        toast(
          wantUpscale
            ? bay === "h3"
              ? `Апскейл · чанки 1–${s.h3.chunks}`
              : "Апскейл в очереди"
            : bay === "upscale"
              ? `Апскейл · чанки 1–${s.upscale.chunks}`
              : bay === "h3" && s.h3.genMode === "chunks"
                ? `Chunks · ${chunkJobLabel(s.h3.chunkSec, s.h3.chunkCount)}`
                : "В очереди ComfyUI",
        );
        const item = await waitForPrompt(
          s.comfyUrl,
          queued.prompt_id,
          () => {
            /* sampler progress is driven by the websocket */
          },
          bay === "h3" && s.h3.genMode === "chunks" ? 50 * 60_000 : 15 * 60_000,
          runAbort.signal,
        );
        const out = pickOutput(
          item,
          bay === "h3" ? (wantUpscale ? "792" : "269") : "seamless_save",
          bay === "h3" || bay === "upscale" ? "video" : "image",
        );
        const elapsed = Date.now() - t0;
        if (!out) {
          useLab.getState().patchJob(job.id, {
            status: "done",
            progress: 100,
            durationMs: elapsed,
            note: "Готово, превью не нашли",
          });
          toast.error("Comfy закончил, но файл результата не пришёл в историю");
        } else {
          const blob = await fetchViewBlob(s.comfyUrl, out.file);
          if (!blob || blob.size < 64) {
            useLab.getState().patchJob(job.id, {
              status: "done",
              progress: 100,
              durationMs: elapsed,
              note: "Готово, файл результата пустой",
            });
            toast.error("Comfy закончил, но файл результата пустой");
          } else {
          const url = URL.createObjectURL(blob);
          void putGalleryBlob(job.id, blob);
          useLab.getState().patchJob(job.id, {
            status: "done",
            progress: 100,
            durationMs: elapsed,
            resultUrl: url,
            kind: out.kind,
            thumb: out.kind === "image" ? url : demo.thumb,
          });
          const before =
            bay === "edit"
              ? wantUpscale
                ? useLab.getState().previewEdit
                : s.edit.image1
                  ? s.edit.image1.croppedUrl || s.edit.image1.url
                  : null
              : null;
          useLab.getState().setPreview(bay, url, before);
          useLab.getState().setCompareOn(false);
          toast.success(wantUpscale ? "Апскейл готов" : "Готово");
          }
        }
      } finally {
        socket.stop();
        useLab.getState().setLive({ frame: null, hint: "", progress: 0 });
      }
    } else {
      await new Promise((r) => setTimeout(r, bay === "h3" ? 3200 : 1800));
      const elapsed = Date.now() - t0;
      useLab.getState().patchJob(job.id, {
        status: "done",
        progress: 100,
        durationMs: elapsed,
        resultUrl: demo.url,
      });
      useLab.getState().setPreview(bay, demo.url, bay === "edit" ? "/demo/edit-sheet.jpg" : null);
      useLab.getState().setCompareOn(false);
      toast(bay === "h3" || bay === "upscale" ? "Демо-ролик готов" : "Демо-кадр готов");
    }
  } catch (err) {
    if (runAbort?.signal.aborted || (err instanceof Error && err.message === "Прервано")) {
      useLab.getState().patchJob(job.id, { status: "interrupted", progress: 0, note: "Прервано" });
    } else {
      const message = err instanceof Error ? err.message : "ошибка";
      useLab.getState().patchJob(job.id, { status: "error", progress: 0, note: message });
      toast.error(message, { duration: 8000 });
    }
  } finally {
    clearInterval(tick);
    useLab.getState().setRunning(null);
    runAbort = null;
    if (wantUpscale) {
      const st = useLab.getState();
      if (bay === "edit") st.patchEdit({ upscale: false });
      if (bay === "h3") st.patchH3({ upscale: false });
      if (bay === "krea") st.patchKrea({ upscale: false });
    }
  }
}

export async function refreshLink(opts?: { silent?: boolean }) {
  const s = useLab.getState();
  if (!s.comfyUrl.trim()) {
    s.setConnection("demo", {});
    return;
  }
  s.setConnection("checking");
  const { status, info } = await pingComfy(s.comfyUrl);
  s.setConnection(status, info);
  const greetKey = "zero:comfy-ok";
  const prev = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(greetKey) : null;
  if (status === "online") {
    const already = prev === s.comfyUrl;
    if (!opts?.silent || !already) {
      toast.success(info.gpu ? `Подключено · ${info.gpu}${info.vram ? ` · ${info.vram}` : ""}` : "ComfyUI на связи");
    }
    try {
      sessionStorage.setItem(greetKey, s.comfyUrl);
    } catch {
      /* private mode */
    }
    try {
      const files = await fetchComfyLoras(s.comfyUrl);
      if (files.length) useLab.getState().setAvailableLoras(files);
    } catch {
      /* catalog stays on built-in names */
    }
    try {
      const cat = await fetchComfyCatalog(s.comfyUrl);
      const patch: Partial<import("./types").ModelCatalog> = {};
      if (cat.unet.length) patch.unet = cat.unet;
      if (cat.llm.length) patch.llm = cat.llm;
      if (cat.mmproj.length) patch.mmproj = cat.mmproj;
      if (cat.systemPrompts.length) patch.systemPrompts = cat.systemPrompts;
      if (cat.samplers.length) patch.samplers = cat.samplers;
      if (cat.schedulers.length) patch.schedulers = cat.schedulers;
      if (cat.upscaleModels.length) patch.upscaleModels = cat.upscaleModels;
      if (Object.keys(patch).length) useLab.getState().setCatalogs(patch);
    } catch {
      /* keep defaults */
    }
  } else if (status === "offline") {
    try {
      sessionStorage.removeItem(greetKey);
    } catch {
      /* */
    }
    toast.error(info.error || `Нет связи с ${s.comfyUrl}`);
  }
}
