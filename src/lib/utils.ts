import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatPrecise(seconds: number, digits = 1) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const rem = seconds - m * 60;
  const s = rem.toFixed(digits);
  const [w, f] = s.split(".");
  return `${m}:${w.padStart(2, "0")}.${f}`;
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function snap(n: number, grid: number) {
  return Math.max(grid, Math.round(n / grid) * grid);
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadUrl(filename: string, url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function fileKind(file: File): "picture" | "video" | "audio" | null {
  if (file.type.startsWith("image/")) return "picture";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  const n = file.name.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp)$/.test(n)) return "picture";
  if (/\.(mp4|webm|mov|mkv)$/.test(n)) return "video";
  if (/\.(mp3|wav|ogg|flac|m4a)$/.test(n)) return "audio";
  return null;
}
