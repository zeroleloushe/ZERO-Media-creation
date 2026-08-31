import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  buildFilmstrip,
  buildWaveform,
  captureFrame,
  extractWav,
} from "@/lib/media";
import type { MediaItem } from "@/lib/types";
import { cn, formatPrecise } from "@/lib/utils";
import {
  ChevronsLeft,
  ChevronsRight,
  FlipHorizontal,
  ImageDown,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const FPS = 24;
const FRAME = 1 / FPS;

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function ticks(duration: number) {
  if (duration <= 4) return 0.5;
  if (duration <= 12) return 1;
  if (duration <= 30) return 2;
  if (duration <= 90) return 5;
  return 10;
}

function waveImage(data: Float32Array, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(196,165,116,0.7)";
  const mid = h / 2;
  const n = data.length;
  const bar = Math.max(1, w / n);
  for (let i = 0; i < n; i++) {
    const amp = Math.max(1, data[i] * (h * 0.46));
    ctx.fillRect(i * bar, mid - amp, Math.max(1, bar * 0.85), amp * 2);
  }
  return canvas.toDataURL("image/png");
}

export function TrimDialog({
  item,
  snapTo,
  onClose,
  onApply,
  onUseFrame,
  onUseAudio,
}: {
  item: MediaItem;
  snapTo?: number;
  onClose: () => void;
  onApply: (trimStart: number, trimLength: number) => void;
  onUseFrame?: (blob: Blob, time: number) => void;
  onUseAudio?: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<null | { mode: "in" | "out" | "move" | "head"; x: number; start: number; end: number }>(null);

  const [duration, setDuration] = useState(item.duration || 0);
  const [start, setStart] = useState(item.trimStart || 0);
  const [end, setEnd] = useState(item.trimLength ? item.trimStart + item.trimLength : item.duration || 0);
  const [head, setHead] = useState(item.trimStart || 0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [strip, setStrip] = useState<string | null>(null);
  const [wave, setWave] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inText, setInText] = useState("");
  const [outText, setOutText] = useState("");

  const length = Math.max(FRAME, end - start);
  const isVideo = item.kind === "video";
  const live = isVideo ? videoRef : audioRef;
  const state = useRef({ start, end, head, playing, duration, length });
  state.current = { start, end, head, playing, duration, length };

  useEffect(() => {
    setInText(start.toFixed(2));
    setOutText(end.toFixed(2));
  }, [start, end]);

  useEffect(() => {
    let dead = false;
    if (isVideo) {
      void buildFilmstrip(item.url, 36, 64)
        .then((s) => {
          if (!dead) setStrip(s.url);
        })
        .catch(() => {
          if (!dead) setStrip(null);
        });
    }
    void buildWaveform(item.url, 800)
      .then((p) => {
        if (!dead) setWave(waveImage(p, 1400, isVideo ? 48 : 160));
      })
      .catch(() => {
        if (!dead) setWave(null);
      });
    return () => {
      dead = true;
    };
  }, [item.url, isVideo]);

  function onMeta(el: HTMLMediaElement) {
    const d = el.duration || item.duration || 0;
    if (Number.isFinite(d) && d > 0) {
      setDuration(d);
      setEnd((prev) => (item.trimLength ? item.trimStart + item.trimLength : d));
    }
    if (el instanceof HTMLVideoElement && el.videoWidth) {
      setSize({ w: el.videoWidth, h: el.videoHeight });
    }
  }

  useEffect(() => {
    const el = live.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const t = el.currentTime || 0;
      setHead(t);
      const s = state.current;
      if (s.playing && t >= s.end - 0.04) el.currentTime = s.start;
      raf = requestAnimationFrame(tick);
    };
    if (playing) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, live]);

  function seek(t: number) {
    const el = live.current;
    const d = state.current.duration;
    const next = clamp(t, 0, d || t);
    setHead(next);
    if (el) el.currentTime = next;
  }

  function toggle() {
    const el = live.current;
    if (!el) return;
    const s = state.current;
    if (s.playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    if (el.currentTime < s.start - 0.05 || el.currentTime >= s.end - 0.05) el.currentTime = s.start;
    void el.play();
    setPlaying(true);
  }

  function step(dir: number, many = false) {
    const delta = (many ? 10 : 1) * FRAME * dir;
    seek(state.current.head + delta);
  }

  function setIn(v: number) {
    const s = state.current;
    const next = clamp(v, 0, s.end - FRAME);
    setStart(next);
    if (s.head < next) seek(next);
  }
  function setOut(v: number) {
    const s = state.current;
    const next = clamp(v, s.start + FRAME, s.duration || v);
    setEnd(next);
    if (s.head > next) seek(next);
  }

  function timeFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    const d = state.current.duration;
    if (!rect || !d) return 0;
    return clamp(((clientX - rect.left) / rect.width) * d, 0, d);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const s = state.current;
    if (!s.duration) return;
    const t = timeFromClientX(e.clientX);
    const rect = trackRef.current!.getBoundingClientRect();
    const px = (x: number) => (x / s.duration) * rect.width;
    const x = e.clientX - rect.left;
    const inX = px(s.start);
    const outX = px(s.end);
    let mode: "in" | "out" | "move" | "head" = "head";
    if (Math.abs(x - inX) < 12) mode = "in";
    else if (Math.abs(x - outX) < 12) mode = "out";
    else if (x > inX && x < outX) mode = "move";
    drag.current = { mode, x: e.clientX, start: s.start, end: s.end };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (mode === "head") seek(t);
    if (s.playing) {
      live.current?.pause();
      setPlaying(false);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const t = timeFromClientX(e.clientX);
    if (d.mode === "in") setIn(t);
    else if (d.mode === "out") setOut(t);
    else if (d.mode === "head") seek(t);
    else {
      const dt = timeFromClientX(e.clientX) - timeFromClientX(d.x);
      const span = d.end - d.start;
      const dur = state.current.duration;
      const ns = clamp(d.start + dt, 0, Math.max(0, dur - span));
      setStart(ns);
      setEnd(ns + span);
    }
  }

  function onPointerUp() {
    drag.current = null;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const s = state.current;
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1, e.shiftKey);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1, e.shiftKey);
      } else if (e.key === "[") setIn(s.head);
      else if (e.key === "]") setOut(s.head);
      else if (e.key === "Home") {
        e.preventDefault();
        seek(e.shiftKey ? s.start : 0);
      } else if (e.key === "End") {
        e.preventDefault();
        seek(e.shiftKey ? s.end : s.duration);
      } else if (e.key === "m" || e.key === "M") setMuted((v) => !v);
      else if ((e.key === "a" || e.key === "A") && isVideo) void grabAudio();
      else if ((e.key === "c" || e.key === "C") && isVideo) void grabFrame();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideo]);

  async function grabFrame() {
    if (!onUseFrame) return;
    setBusy("Кадр…");
    try {
      const blob = await captureFrame(item.url, state.current.head);
      onUseFrame(blob, state.current.head);
      toast.success("Кадр ушёл в референсы");
    } catch {
      toast.error("Не удалось снять кадр");
    } finally {
      setBusy(null);
    }
  }

  async function grabAudio() {
    if (!onUseAudio) return;
    setBusy("Аудио…");
    try {
      const s = state.current;
      const blob = await extractWav(item.url, s.start, s.length);
      onUseAudio(blob);
      toast.success("Аудио вырезано из ролика");
    } catch {
      toast.error("В ролике нет дорожки или браузер не декодировал");
    } finally {
      setBusy(null);
    }
  }

  function lastSeconds(sec: number) {
    const d = state.current.duration;
    const span = Math.min(sec, d);
    setStart(Math.max(0, d - span));
    setEnd(d);
    seek(Math.max(0, d - span));
  }

  const left = duration ? (start / duration) * 100 : 0;
  const right = duration ? (end / duration) * 100 : 100;
  const headPct = duration ? (head / duration) * 100 : 0;
  const stepMarks = duration ? ticks(duration) : 1;
  const marks: number[] = [];
  if (duration) {
    for (let t = 0; t <= duration + 0.001; t += stepMarks) marks.push(Number(Math.min(t, duration).toFixed(3)));
  }

  return (
    <Dialog open onClose={onClose} title={item.name} wide="xl">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <button
            type="button"
            onClick={() => setMirror((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5",
              mirror ? "bg-chip text-fg" : "text-muted hover:text-fg",
            )}
          >
            <FlipHorizontal className="size-3.5" />
            Зеркало
          </button>
          <span className="font-mono tabular-nums">
            {size ? `${size.w} × ${size.h}` : isVideo ? "видео" : "аудио"}
            {duration ? ` · ${formatPrecise(duration, 2)}` : ""}
          </span>
          {busy ? <span className="text-accent">{busy}</span> : null}
        </div>

        <div className="relative overflow-hidden rounded-xl bg-bg">
          {isVideo ? (
            <video
              ref={videoRef}
              src={item.url}
              muted={muted}
              playsInline
              className={cn("mx-auto max-h-[42dvh] w-full bg-bg object-contain", mirror && "-scale-x-100")}
              onLoadedMetadata={(e) => onMeta(e.currentTarget)}
              onClick={() => toggle()}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            <div className="relative flex h-40 items-center bg-elevated">
              <audio
                ref={audioRef}
                src={item.url}
                muted={muted}
                onLoadedMetadata={(e) => onMeta(e.currentTarget)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
              {wave ? (
                <img src={wave} alt="" className="size-full object-fill" />
              ) : (
                <span className="w-full text-center text-sm text-muted">Читаю волну…</span>
              )}
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-bg/80 px-2 py-1 font-mono text-[11px] tabular-nums">
            PLAYHEAD {formatPrecise(head, 1)}
          </div>
        </div>

        <div
          ref={trackRef}
          className="relative select-none touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="relative mb-1 h-4 font-mono text-[10px] tabular-nums text-subtle">
            {marks.map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2"
                style={{ left: duration ? `${(t / duration) * 100}%` : 0 }}
              >
                {formatPrecise(t, duration < 10 ? 1 : 0)}
              </span>
            ))}
          </div>
          <div className="relative h-16 overflow-hidden rounded-lg bg-chip">
            {isVideo && strip ? (
              <img src={strip} alt="" className="absolute inset-0 size-full object-fill" />
            ) : null}
            {wave ? (
              <img
                src={wave}
                alt=""
                className={cn("absolute inset-x-0 w-full object-fill", isVideo ? "bottom-0 h-6 opacity-80" : "inset-0 size-full")}
              />
            ) : null}
            <div className="absolute inset-y-0 bg-bg/55" style={{ left: 0, width: `${left}%` }} />
            <div className="absolute inset-y-0 bg-bg/55" style={{ left: `${right}%`, right: 0 }} />
            <div
              className="absolute inset-y-0 border-x-2 border-accent bg-accent/20"
              style={{ left: `${left}%`, width: `${Math.max(0.5, right - left)}%` }}
            />
            <div className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize" style={{ left: `${left}%` }}>
              <span className="absolute inset-y-1 left-1/2 w-1 -translate-x-1/2 rounded-full bg-accent" />
            </div>
            <div className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize" style={{ left: `${right}%` }}>
              <span className="absolute inset-y-1 left-1/2 w-1 -translate-x-1/2 rounded-full bg-accent" />
            </div>
            <div className="absolute inset-y-0 z-20 w-px bg-primary" style={{ left: `${headPct}%` }}>
              <span className="absolute -top-0.5 left-1/2 size-2.5 -translate-x-1/2 rounded-sm bg-primary" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="grid size-10 place-items-center rounded-lg bg-chip" onClick={() => setMuted((v) => !v)} aria-label="Звук">
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button type="button" className="grid size-10 place-items-center rounded-lg bg-chip" onClick={() => step(-1)} aria-label="Кадр назад">
            <SkipBack className="size-4" />
          </button>
          <button type="button" className="grid size-11 place-items-center rounded-full bg-primary text-primary-fg" onClick={() => toggle()} aria-label="Играть">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button type="button" className="grid size-10 place-items-center rounded-lg bg-chip" onClick={() => step(1)} aria-label="Кадр вперёд">
            <SkipForward className="size-4" />
          </button>

          <div className="mx-1 hidden h-8 w-px bg-line sm:block" />

          <Button variant="subtle" size="sm" onClick={() => setIn(head)}>
            I · старт
          </Button>
          <input
            className="h-9 w-[4.5rem] rounded-md bg-chip px-2 text-center font-mono text-sm tabular-nums outline-none"
            value={inText}
            onChange={(e) => setInText(e.target.value)}
            onBlur={() => {
              const n = Number(inText);
              if (Number.isFinite(n)) setIn(n);
              else setInText(start.toFixed(2));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <input
            className="h-9 w-[4.5rem] rounded-md bg-chip px-2 text-center font-mono text-sm tabular-nums outline-none"
            value={outText}
            onChange={(e) => setOutText(e.target.value)}
            onBlur={() => {
              const n = Number(outText);
              if (Number.isFinite(n)) setOut(n);
              else setOutText(end.toFixed(2));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <Button variant="subtle" size="sm" onClick={() => setOut(head)}>
            конец · O
          </Button>
          <span className="font-mono text-xs tabular-nums text-muted">{length.toFixed(2)} с в нарезке</span>

          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => seek(0)} aria-label="В начало">
              <ChevronsLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => seek(duration)} aria-label="В конец">
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => lastSeconds(2)}>
            last 2s
          </Button>
          <Button variant="subtle" size="sm" onClick={() => lastSeconds(3)}>
            last 3s
          </Button>
          {snapTo ? (
            <Button variant="subtle" size="sm" onClick={() => lastSeconds(snapTo)}>
              как ролик · {snapTo} с
            </Button>
          ) : null}
          {isVideo && onUseFrame ? (
            <Button variant="subtle" size="sm" onClick={() => void grabFrame()}>
              <ImageDown className="size-3.5" />
              Взять кадр
            </Button>
          ) : null}
          {isVideo && onUseAudio ? (
            <Button variant="subtle" size="sm" onClick={() => void grabAudio()}>
              <Music className="size-3.5" />
              Взять аудио
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="primary" onClick={() => onApply(Number(start.toFixed(3)), Number(length.toFixed(3)))}>
              Применить
            </Button>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-subtle">
          ← → кадр (Shift · 10) · пробел · [ ] in/out · Home/End · M mute
          {isVideo ? " · C кадр · A аудио" : ""}
        </p>
      </div>
    </Dialog>
  );
}
