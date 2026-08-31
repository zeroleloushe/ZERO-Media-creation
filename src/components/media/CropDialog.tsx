import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/group";
import { Dialog } from "@/components/ui/dialog";
import { CROP_ASPECTS, aspectValue } from "@/lib/presets";
import { cropToBlob } from "@/lib/media";
import type { CropRect, MediaItem } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Handle = "move" | "nw" | "ne" | "sw" | "se";

function clampCrop(c: CropRect, nw: number, nh: number, aspect: number | null): CropRect {
  let { x, y, w, h } = c;
  w = Math.min(Math.max(32, w), nw);
  h = Math.min(Math.max(32, h), nh);
  if (aspect) {
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
    w = Math.min(w, nw);
    h = Math.min(h, nh);
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
  }
  x = Math.min(Math.max(0, x), nw - w);
  y = Math.min(Math.max(0, y), nh - h);
  return { ...c, x, y, w, h };
}

export function CropDialog({
  item,
  outputAspect,
  onClose,
  onApply,
}: {
  item: MediaItem;
  outputAspect?: { w: number; h: number };
  onClose: () => void;
  onApply: (crop: CropRect, croppedUrl: string) => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [aspectId, setAspectId] = useState(item.crop?.aspect ?? "free");
  const [crop, setCrop] = useState<CropRect>(
    item.crop ?? { x: 0, y: 0, w: item.width ?? 1, h: item.height ?? 1, aspect: "free" },
  );
  const drag = useRef<{ handle: Handle; sx: number; sy: number; start: CropRect } | null>(null);

  const [tick, setTick] = useState(0);

  const nw = item.width ?? 1;
  const nh = item.height ?? 1;

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTick((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!item.crop) {
      setCrop({ x: 0, y: 0, w: nw, h: nh, aspect: "free" });
    }
  }, [item.id, nw, nh, item.crop]);

  function applyAspect(id: string) {
    setAspectId(id);
    const a = aspectValue(id, outputAspect);
    setCrop((c) => clampCrop({ ...c, aspect: id }, nw, nh, a));
  }

  function layout() {
    const view = viewRef.current;
    if (!view) return null;
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const s = Math.min(vw / nw, vh / nh);
    const dw = nw * s;
    const dh = nh * s;
    const ox = (vw - dw) / 2;
    const oy = (vh - dh) / 2;
    return { s, ox, oy, dw, dh };
  }

  function onPointerDown(handle: Handle, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { handle, sx: e.clientX, sy: e.clientY, start: crop };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const L = layout();
    if (!d || !L) return;
    const dx = (e.clientX - d.sx) / L.s;
    const dy = (e.clientY - d.sy) / L.s;
    const a = aspectValue(aspectId, outputAspect);
    let next = { ...d.start };
    if (d.handle === "move") {
      next.x += dx;
      next.y += dy;
    } else {
      if (d.handle.includes("e")) next.w = d.start.w + dx;
      if (d.handle.includes("w")) {
        next.w = d.start.w - dx;
        next.x = d.start.x + dx;
      }
      if (d.handle.includes("s")) next.h = d.start.h + dy;
      if (d.handle.includes("n")) {
        next.h = d.start.h - dy;
        next.y = d.start.y + dy;
      }
    }
    setCrop(clampCrop({ ...next, aspect: aspectId }, nw, nh, a));
  }

  function onPointerUp() {
    drag.current = null;
  }

  async function apply() {
    const blob = await cropToBlob(item.url, crop);
    const croppedUrl = URL.createObjectURL(blob);
    onApply({ ...crop, aspect: aspectId }, croppedUrl);
  }

  void tick;
  const L = typeof window !== "undefined" ? layout() : null;

  return (
    <Dialog open onClose={onClose} title="Обрезать кадр" wide>
      <div className="flex flex-col gap-4 p-4">
        <div
          ref={viewRef}
          className="relative h-[52dvh] overflow-hidden rounded-xl bg-bg"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <img
            ref={imgRef}
            src={item.url}
            alt=""
            className="pointer-events-none h-full w-full object-contain"
          />
          {L ? (
            <div
              className="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{
                left: L.ox + crop.x * L.s,
                top: L.oy + crop.y * L.s,
                width: crop.w * L.s,
                height: crop.h * L.s,
              }}
              onPointerDown={(e) => onPointerDown("move", e)}
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-primary/25" />
                ))}
              </div>
              {(["nw", "ne", "sw", "se"] as Handle[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-label={h}
                  className="absolute size-4 rounded-full bg-primary"
                  style={{
                    left: h.includes("w") ? -8 : undefined,
                    right: h.includes("e") ? -8 : undefined,
                    top: h.includes("n") ? -8 : undefined,
                    bottom: h.includes("s") ? -8 : undefined,
                  }}
                  onPointerDown={(e) => onPointerDown(h, e)}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CROP_ASPECTS.map((a) => (
            <Chip key={a.id} active={aspectId === a.id} onClick={() => applyAspect(a.id)}>
              {a.label}
            </Chip>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tabular-nums text-muted">
            {Math.round(crop.w)} × {Math.round(crop.h)}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="primary" onClick={() => void apply()}>
              Обрезать
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
