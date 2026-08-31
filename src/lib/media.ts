import type { MediaBundle, MediaItem, MediaKind } from "./types";
import { uid } from "./utils";
import { delGalleryBlob, getGalleryBlob, putGalleryBlob } from "./gallery-db";

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function mediaDuration(url: string, kind: "video" | "audio") {
  return new Promise<number>((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      resolve(el.duration || 0);
      el.src = "";
    };
    el.onerror = () => resolve(0);
    el.src = url;
  });
}

export function refBlobKey(id: string, crop = false) {
  return crop ? `ref:${id}:crop` : `ref:${id}`;
}

export function freezeMedia(item: MediaItem): MediaItem {
  return {
    ...item,
    url: item.url.startsWith("blob:") ? "" : item.url,
    croppedUrl: undefined,
  };
}

export function freezeBundle(b: MediaBundle): MediaBundle {
  return {
    pictures: b.pictures.map(freezeMedia),
    videos: b.videos.map(freezeMedia),
    audios: b.audios.map(freezeMedia),
  };
}

export async function forgetMedia(item?: MediaItem | null) {
  if (!item?.id) return;
  if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
  if (item.croppedUrl?.startsWith("blob:")) URL.revokeObjectURL(item.croppedUrl);
  try {
    await delGalleryBlob(refBlobKey(item.id));
    await delGalleryBlob(refBlobKey(item.id, true));
  } catch {
    /* quota / private mode */
  }
}

export async function rememberCropped(item: MediaItem, croppedUrl: string) {
  try {
    const blob = await fetch(croppedUrl).then((r) => r.blob());
    if (blob.size) await putGalleryBlob(refBlobKey(item.id, true), blob);
  } catch {
    /* ignore */
  }
}

export async function thawItem(item: MediaItem | null | undefined): Promise<MediaItem | null> {
  if (!item?.id) return item ?? null;
  const durable = item.url && !item.url.startsWith("blob:");
  const blob = await getGalleryBlob(refBlobKey(item.id)).catch(() => null);
  if (!blob) return durable ? item : null;
  const url = URL.createObjectURL(blob);
  const cropBlob = await getGalleryBlob(refBlobKey(item.id, true)).catch(() => null);
  return {
    ...item,
    url,
    croppedUrl: cropBlob ? URL.createObjectURL(cropBlob) : undefined,
  };
}

export async function thawList(items: MediaItem[] | undefined): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  for (const it of items ?? []) {
    const live = await thawItem(it);
    if (live) out.push(live);
  }
  return out;
}

export async function thawBundle(b: MediaBundle | undefined): Promise<MediaBundle> {
  return {
    pictures: await thawList(b?.pictures),
    videos: await thawList(b?.videos),
    audios: await thawList(b?.audios),
  };
}

export async function itemFromFile(file: File, kind: MediaKind, id = uid(kind)): Promise<MediaItem> {
  try {
    await putGalleryBlob(refBlobKey(id), file);
  } catch {
    /* still usable in this session via object URL */
  }
  const url = URL.createObjectURL(file);
  const item: MediaItem = {
    id,
    kind,
    name: file.name,
    url,
    mime: file.type || "application/octet-stream",
    trimStart: 0,
    trimLength: 0,
  };
  if (kind === "picture") {
    try {
      const img = await Promise.race([
        loadImage(url),
        new Promise<HTMLImageElement>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      item.width = img.naturalWidth;
      item.height = img.naturalHeight;
    } catch {
      /* still keep the file — dimensions can stay empty */
    }
  } else {
    item.duration = await mediaDuration(url, kind);
    item.trimLength = item.duration || 0;
    if (kind === "video") {
      try {
        const v = await loadVideo(url);
        item.width = v.videoWidth || undefined;
        item.height = v.videoHeight || undefined;
        v.src = "";
      } catch {
        /* keep the file */
      }
    }
  }
  return item;
}

export async function cropToBlob(src: string, crop: { x: number; y: number; w: number; h: number }, mime = "image/jpeg") {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.w));
  canvas.height = Math.max(1, Math.round(crop.h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), mime, 0.95);
  });
}

export function displayUrl(item: MediaItem) {
  return item.croppedUrl || item.url;
}

function waitSeek(el: HTMLMediaElement, t: number) {
  return new Promise<void>((resolve) => {
    const target = Math.min(Math.max(0, t), Number.isFinite(el.duration) ? el.duration : t);
    if (Math.abs((el.currentTime || 0) - target) < 0.03) {
      resolve();
      return;
    }
    const done = () => {
      el.removeEventListener("seeked", done);
      resolve();
    };
    el.addEventListener("seeked", done);
    el.currentTime = target;
    window.setTimeout(() => {
      el.removeEventListener("seeked", done);
      resolve();
    }, 900);
  });
}

function loadVideo(url: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("video"));
    v.src = url;
  });
}

export async function buildFilmstrip(url: string, frames = 32, height = 56): Promise<{ url: string; frameW: number }> {
  const video = await loadVideo(url);
  await waitSeek(video, 0);
  const vw = video.videoWidth || 16;
  const vh = video.videoHeight || 9;
  const frameW = Math.max(8, Math.round(height * (vw / vh)));
  const canvas = document.createElement("canvas");
  canvas.width = frameW * frames;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const dur = video.duration || 1;
  for (let i = 0; i < frames; i++) {
    const t = ((i + 0.5) / frames) * dur;
    await waitSeek(video, t);
    ctx.drawImage(video, i * frameW, 0, frameW, height);
  }
  video.src = "";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.72);
  });
  return { url: URL.createObjectURL(blob), frameW };
}

export async function buildWaveform(url: string, bins = 600): Promise<Float32Array> {
  const res = await fetch(url);
  const raw = await res.arrayBuffer();
  const ac = new AudioContext();
  try {
    const buf = await ac.decodeAudioData(raw.slice(0));
    const ch = buf.getChannelData(0);
    const out = new Float32Array(bins);
    const step = Math.max(1, Math.floor(ch.length / bins));
    for (let i = 0; i < bins; i++) {
      let peak = 0;
      const from = i * step;
      const to = Math.min(ch.length, from + step);
      for (let j = from; j < to; j++) peak = Math.max(peak, Math.abs(ch[j]));
      out[i] = peak;
    }
    return out;
  } finally {
    void ac.close();
  }
}

export async function captureFrame(url: string, time: number): Promise<Blob> {
  const video = await loadVideo(url);
  await waitSeek(video, time);
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(video, 0, 0);
  video.src = "";
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.95);
  });
}

function writeWav(samples: Float32Array, sampleRate: number) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = pcm.byteLength;
  const buf = new ArrayBuffer(44 + bytes);
  const view = new DataView(buf);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, bytes, true);
  new Uint8Array(buf, 44).set(new Uint8Array(pcm.buffer));
  return new Blob([buf], { type: "audio/wav" });
}

export async function extractWav(url: string, start = 0, length?: number): Promise<Blob> {
  const res = await fetch(url);
  const raw = await res.arrayBuffer();
  const ac = new AudioContext();
  try {
    const buf = await ac.decodeAudioData(raw.slice(0));
    const rate = buf.sampleRate;
    const from = Math.max(0, Math.floor(start * rate));
    const count = Math.max(1, Math.floor((length ?? buf.duration - start) * rate));
    const src = buf.getChannelData(0);
    const slice = src.slice(from, Math.min(src.length, from + count));
    return writeWav(slice, rate);
  } finally {
    void ac.close();
  }
}
