import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function MediaLightbox({
  url,
  kind,
  onClose,
  footer,
  label,
}: {
  url: string;
  kind: "image" | "video";
  onClose: () => void;
  footer?: ReactNode;
  label?: string;
}) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (kind !== "image") return;
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(8, s + 0.25));
      if (e.key === "-" || e.key === "_") {
        setScale((s) => {
          const next = Math.max(1, s - 0.25);
          if (next === 1) setPos({ x: 0, y: 0 });
          return next;
        });
      }
      if (e.key === "0") {
        setScale(1);
        setPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  const zoomBy = useCallback((delta: number, origin?: { x: number; y: number }) => {
    setScale((prev) => {
      const next = Math.min(8, Math.max(1, Math.round((prev + delta) * 100) / 100));
      if (next === 1) {
        setPos({ x: 0, y: 0 });
        return 1;
      }
      if (origin && wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        const cx = origin.x - r.left - r.width / 2;
        const cy = origin.y - r.top - r.height / 2;
        const k = next / prev;
        setPos((p) => ({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (kind !== "image") return;
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -0.2 : 0.2;
      zoomBy(dir, { x: e.clientX, y: e.clientY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [kind, zoomBy]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg/95">
      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          {label || (kind === "video" ? "Ролик" : scale === 1 ? "Просмотр" : `${Math.round(scale * 100)}%`)}
        </p>
        <div className="flex items-center gap-1">
          {kind === "image" ? (
            <>
              <Button variant="subtle" size="icon-sm" onClick={() => zoomBy(-0.25)} aria-label="Отдалить">
                <Minus />
              </Button>
              <button
                type="button"
                className="min-w-12 rounded-md px-2 py-1 font-mono text-[11px] text-muted hover:text-fg"
                onClick={() => {
                  setScale(1);
                  setPos({ x: 0, y: 0 });
                }}
              >
                {Math.round(scale * 100)}%
              </button>
              <Button variant="subtle" size="icon-sm" onClick={() => zoomBy(0.25)} aria-label="Приблизить">
                <Plus />
              </Button>
            </>
          ) : null}
          <Button variant="subtle" size="icon-sm" onClick={onClose} aria-label="Закрыть">
            <X />
          </Button>
        </div>
      </header>
      <div
        ref={wrapRef}
        className={cn(
          "relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3",
          footer ? "pb-3" : "pb-6",
          kind === "image" && scale > 1 ? "cursor-grab active:cursor-grabbing" : kind === "image" ? "cursor-zoom-in" : "",
        )}
        onDoubleClick={(e) => {
          if (kind !== "image") return;
          e.stopPropagation();
          if (scale > 1) {
            setScale(1);
            setPos({ x: 0, y: 0 });
          } else zoomBy(1.5, { x: e.clientX, y: e.clientY });
        }}
        onPointerDown={(e) => {
          if (kind !== "image" || scale <= 1) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPos({
            x: drag.current.x + (e.clientX - drag.current.px),
            y: drag.current.y + (e.clientY - drag.current.py),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        <button
          type="button"
          aria-label="Закрыть"
          className="absolute inset-0 cursor-zoom-out"
          onClick={onClose}
        />
        {kind === "video" ? (
          <video
            src={url}
            className="relative z-10 max-h-full max-w-full rounded-lg object-contain"
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            src={url}
            alt=""
            draggable={false}
            className="relative z-10 max-h-full max-w-full select-none object-contain"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: dragging ? "none" : "transform 120ms ease-out",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (scale === 1) zoomBy(1, { x: e.clientX, y: e.clientY });
            }}
          />
        )}
      </div>
      {footer ? <div className="relative z-10 shrink-0 border-t border-line bg-surface px-4 py-3">{footer}</div> : null}
    </div>
  );
}