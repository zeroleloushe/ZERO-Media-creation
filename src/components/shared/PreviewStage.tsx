import { Button } from "@/components/ui/button";
import { cn, downloadUrl } from "@/lib/utils";
import { useLab } from "@/lib/store";
import { Download, Pause, Play, Volume2, VolumeX, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MediaLightbox } from "./MediaLightbox";

const fill = "absolute inset-0 h-full w-full object-contain p-3";

function Flipbook({ frames, fps }: { frames: string[]; fps: number }) {
  const [i, setI] = useState(Math.max(0, frames.length - 1));
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    setI(frames.length - 1);
  }, [frames.length]);
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % frames.length), Math.max(40, 1000 / fps));
    return () => window.clearInterval(id);
  }, [frames.length, fps, playing]);
  return (
    <>
      <img src={frames[i] ?? frames.at(-1)} alt="" className={fill} />
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-bg/70 px-2 py-1">
        <button type="button" className="text-muted hover:text-fg" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <span className="font-mono text-[10px] tabular-nums text-muted">
          {i + 1}/{frames.length}
        </span>
      </div>
    </>
  );
}

export function PreviewStage({
  url,
  kind,
  compare,
  empty,
  running,
  liveUrl,
  liveFrames,
  liveFps = 10,
  liveMime,
  liveTick = 0,
  progress,
  hint,
  onUpscale,
}: {
  url: string | null;
  kind: "image" | "video";
  compare?: string | null;
  empty: string;
  running?: boolean;
  liveUrl?: string | null;
  liveFrames?: string[];
  liveFps?: number;
  liveMime?: string | null;
  liveTick?: number;
  progress?: number;
  hint?: string;
  onUpscale?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [split, setSplit] = useState(50);
  const [lightbox, setLightbox] = useState(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || kind !== "video" || running) return;
    v.muted = muted;
    const play = v.play();
    if (play) {
      void play.catch(() => {
        v.muted = true;
        setMuted(true);
        void v.play();
      });
    }
  }, [url, kind, running, muted]);
  const compareOn = useLab((s) => s.compareOn);
  const setCompareOn = useLab((s) => s.setCompareOn);
  const sequence = running && liveFrames && liveFrames.length > 1;
  const showLive = Boolean(running && (liveUrl || sequence));
  const frame = sequence ? liveFrames![liveFrames!.length - 1] : showLive ? liveUrl : url;
  const useCompare = Boolean(compare && frame && !showLive && compareOn);
  const canInspect = Boolean(frame && !running && !showLive);

  function openInspect(e?: { stopPropagation(): void }) {
    e?.stopPropagation();
    if (canInspect) setLightbox(true);
  }

  const mediaFill = cn(fill, canInspect && "cursor-zoom-in");
  const liveKey = `live-${liveTick}`;
  const showUpscale = Boolean(onUpscale && url && !running);

  const videoButtons = (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5">
      <Button
        variant="subtle"
        size="icon-sm"
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) void v.play();
          else v.pause();
        }}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button
        variant="subtle"
        size="icon-sm"
        onClick={() => {
          const next = !muted;
          setMuted(next);
          if (videoRef.current) videoRef.current.muted = next;
        }}
        aria-label={muted ? "Включить звук" : "Выключить звук"}
      >
        {muted ? <VolumeX /> : <Volume2 />}
      </Button>
      <Button variant="subtle" size="icon-sm" onClick={() => url && downloadUrl("seamless.mp4", url)}>
        <Download />
      </Button>
      {showUpscale ? (
        <Button variant="accent" size="sm" className="px-3" onClick={onUpscale}>
          <Zap className="size-3.5" />
          Upscale
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex min-h-[320px] w-full flex-1 items-center justify-center overflow-hidden rounded-2xl bg-surface lg:min-h-0">
      {!frame ? (
        <div className="flex flex-col items-center gap-3 px-8 text-center">
          <div className="flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="size-1.5 rounded-full bg-chip" />
            ))}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {running ? hint || "waiting for sample…" : empty}
          </p>
        </div>
      ) : useCompare ? (
        <div className="relative size-full">
          <img
            src={frame ?? ""}
            alt=""
            className={cn("absolute inset-0 size-full object-contain", canInspect && "cursor-zoom-in")}
            onClick={openInspect}
          />
          <div className="absolute inset-0 pointer-events-none" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
            <img src={compare ?? ""} alt="" className="absolute inset-0 size-full object-contain" />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            className="absolute inset-x-8 bottom-4 z-10 accent-accent"
          />
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-bg/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            До
          </div>
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-bg/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            После
          </div>
        </div>
      ) : showLive || kind === "image" || (frame && kind === "video" && running) ? (
        <>
          {showLive && liveMime?.startsWith("video/") ? (
            <>
              <video key={liveKey} src={frame ?? undefined} className={fill} autoPlay loop muted playsInline />
              <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-bg">
                Live
              </span>
            </>
          ) : kind === "video" && !showLive ? (
            <>
              <video
                ref={videoRef}
                src={frame ?? undefined}
                className={mediaFill}
                autoPlay
                loop
                muted={muted}
                playsInline
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={openInspect}
              />
              {videoButtons}
            </>
          ) : sequence ? (
            <>
              <Flipbook frames={liveFrames!} fps={liveFps} />
              <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-bg">
                Live
              </span>
            </>
          ) : (
            <>
              <img
                key={showLive ? liveKey : frame ?? "img"}
                src={frame ?? ""}
                alt=""
                className={mediaFill}
                onClick={openInspect}
              />
              {showLive ? (
                <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-bg">
                  Live
                </span>
              ) : null}
              {!running && frame ? (
                <div className="absolute bottom-3 right-3">
                  <Button variant="subtle" size="icon-sm" onClick={() => downloadUrl("seamless.jpg", frame)}>
                    <Download />
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : kind === "video" ? (
        <>
          <video
            ref={videoRef}
            src={url ?? undefined}
            className={mediaFill}
            autoPlay
            loop
            muted={muted}
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onClick={openInspect}
          />
          {videoButtons}
        </>
      ) : (
        <>
          <img
            src={url ?? ""}
            alt=""
            className={mediaFill}
            onClick={openInspect}
          />
          <div className="absolute bottom-3 right-3">
            <Button variant="subtle" size="icon-sm" onClick={() => url && downloadUrl("seamless.jpg", url)}>
              <Download />
            </Button>
          </div>
        </>
      )}
      {running ? (
        <div className="absolute inset-x-0 bottom-0">
          {hint ? (
            <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-bg/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
              {hint}
            </p>
          ) : null}
          <div className="h-0.5 overflow-hidden bg-chip">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.min(100, Math.max(6, progress ?? 8))}%` }}
            />
          </div>
        </div>
      ) : null}
      {compare && !running ? (
        <button
          type="button"
          onClick={() => setCompareOn(!compareOn)}
          className={cn(
            "absolute right-3 top-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
            compareOn ? "bg-accent text-bg" : "bg-bg/70 text-muted hover:text-fg",
          )}
        >
          Сравнение
        </button>
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-line",
        )}
      />
      {lightbox && frame
        ? createPortal(<MediaLightbox url={frame} kind={kind} onClose={() => setLightbox(false)} />, document.body)
        : null}
    </div>
  );
}
