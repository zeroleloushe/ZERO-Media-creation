import { CropDialog } from "@/components/media/CropDialog";
import { TrimDialog } from "@/components/media/TrimDialog";
import { useLab } from "@/lib/store";
import { itemFromFile } from "@/lib/media";
import type { MediaBundle, MediaItem, MediaKind } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";
import { Crop, Plus, Scissors, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

type Slot = "pictures" | "videos" | "audios";

const CAP: Record<Slot, number> = { pictures: 9, videos: 3, audios: 3 };

function SlotCard({
  item,
  index,
  kind,
  compact,
  onCrop,
  onTrim,
  onRemove,
}: {
  item?: MediaItem;
  index: number;
  kind: MediaKind;
  compact?: boolean;
  onCrop?: () => void;
  onTrim?: () => void;
  onRemove?: () => void;
  onAdd?: () => void;
}) {
  if (!item) return null;
  const src = item.croppedUrl || item.url;
  return (
    <article className={cn("group relative shrink-0 overflow-hidden rounded-xl bg-elevated", compact ? "w-[72px]" : "w-[108px]")}>
      <div className="relative aspect-[3/4] bg-chip">
        {kind === "picture" ? (
          <img src={src} alt="" className="size-full object-cover" />
        ) : kind === "video" ? (
          <video
            src={item.url}
            className="size-full object-cover"
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = item.trimStart || 0.05;
            }}
          />
        ) : (
          <div className="flex size-full items-center justify-center px-2 text-center text-[11px] text-muted">
            {item.name}
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-bg/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
          {index}
        </span>
        {item.trimLength ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-bg/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
            {formatTime(item.trimLength)}
          </span>
        ) : null}
      </div>
      <div className="flex border-t border-line">
        {kind === "picture" ? (
          <button type="button" className="grid h-8 flex-1 place-items-center text-muted hover:text-fg" onClick={onCrop} aria-label="Кроп">
            <Crop className="size-3.5" />
          </button>
        ) : (
          <button type="button" className="grid h-8 flex-1 place-items-center text-muted hover:text-fg" onClick={onTrim} aria-label="Обрезать">
            <Scissors className="size-3.5" />
          </button>
        )}
        <button type="button" className="grid h-8 flex-1 place-items-center text-muted hover:text-danger" onClick={onRemove} aria-label="Удалить">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </article>
  );
}

function AddTile({
  label,
  accept,
  multiple,
  compact,
  onFiles,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  compact?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <label
      className={cn(
        "relative flex shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-muted hover:border-fg/40 hover:text-fg",
        compact ? "h-[calc(72px*4/3+32px)] w-[72px]" : "h-[calc(108px*4/3+32px)] w-[108px]",
      )}
    >
      <Plus className="size-4" />
      <span className="px-2 text-center text-[11px] leading-tight">{label}</span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

function Row({
  title,
  hint,
  children,
  onDropFiles,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  onDropFiles: (files: FileList) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">{title}</h3>
        <span className="text-[11px] text-subtle">{hint}</span>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) onDropFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex gap-2 overflow-x-auto pb-1",
          over && "ring-1 ring-accent/50 rounded-xl",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function MediaBayView({
  bundle,
  onChange,
  snapTo,
  compact,
}: {
  bundle: MediaBundle;
  onChange: (next: MediaBundle) => void;
  snapTo?: number;
  compact?: boolean;
}) {
  const [cropItem, setCropItem] = useState<{ slot: Slot; item: MediaItem } | null>(null);
  const [trimItem, setTrimItem] = useState<{ slot: Slot; item: MediaItem } | null>(null);

  function setSlot(slot: Slot, items: MediaItem[]) {
    onChange({ ...bundle, [slot]: items });
  }

  async function ingest(slot: Slot, kind: MediaKind, files: FileList | File[]) {
    const list = Array.from(files);
    const next = [...bundle[slot]];
    let added = 0;
    for (const file of list) {
      if (next.length >= CAP[slot]) break;
      try {
        next.push(await itemFromFile(file, kind));
        added += 1;
      } catch {
        toast.error(`Не прочитался ${file.name}`);
      }
    }
    if (added) {
      setSlot(slot, next);
      toast.success(added === 1 ? list[0].name : `${added} файла`);
    }
  }

  function patchItem(slot: Slot, id: string, patch: Partial<MediaItem>) {
    setSlot(
      slot,
      bundle[slot].map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }

  const rows: { slot: Slot; kind: MediaKind; title: string; hint: string; accept: string; label: string }[] = [
    { slot: "pictures", kind: "picture", title: "Кадры", hint: `${bundle.pictures.length}/9 · <Picture N>`, accept: "image/*", label: "Кадр" },
    { slot: "videos", kind: "video", title: "Видео", hint: `${bundle.videos.length}/3 · trim`, accept: "video/*", label: "Видео" },
    { slot: "audios", kind: "audio", title: "Аудио", hint: `${bundle.audios.length}/3 · <Audio N>`, accept: "audio/*", label: "Аудио" },
  ];

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-5")}>
      {rows.map((row) => (
        <Row key={row.slot} title={row.title} hint={row.hint} onDropFiles={(f) => void ingest(row.slot, row.kind, f)}>
          {bundle[row.slot].map((item, i) => (
            <SlotCard
              key={item.id}
              item={item}
              index={i + 1}
              kind={row.kind}
              compact={compact}
              onCrop={() => setCropItem({ slot: row.slot, item })}
              onTrim={() => setTrimItem({ slot: row.slot, item })}
              onRemove={() => setSlot(row.slot, bundle[row.slot].filter((m) => m.id !== item.id))}
            />
          ))}
          {bundle[row.slot].length < CAP[row.slot] ? (
            <AddTile
              label={row.label}
              accept={row.accept}
              multiple
              compact={compact}
              onFiles={(files) => void ingest(row.slot, row.kind, files)}
            />
          ) : null}
        </Row>
      ))}

      {cropItem ? (
        <CropDialog
          item={cropItem.item}
          outputAspect={{ w: 1280, h: 544 }}
          onClose={() => setCropItem(null)}
          onApply={(crop, croppedUrl) => {
            patchItem(cropItem.slot, cropItem.item.id, { crop, croppedUrl });
            setCropItem(null);
          }}
        />
      ) : null}
      {trimItem ? (
        <TrimDialog
          item={trimItem.item}
          snapTo={snapTo}
          onClose={() => setTrimItem(null)}
          onApply={(trimStart, trimLength) => {
            patchItem(trimItem.slot, trimItem.item.id, { trimStart, trimLength });
            setTrimItem(null);
          }}
          onUseFrame={async (blob) => {
            const base = trimItem.item.name.replace(/\.[^.]+$/, "");
            const file = new File([blob], `${base}-frame.jpg`, { type: "image/jpeg" });
            const media = await itemFromFile(file, "picture");
            setSlot("pictures", [...bundle.pictures, media].slice(0, CAP.pictures));
          }}
          onUseAudio={async (blob) => {
            const base = trimItem.item.name.replace(/\.[^.]+$/, "");
            const file = new File([blob], `${base}.wav`, { type: "audio/wav" });
            const media = await itemFromFile(file, "audio");
            setSlot("audios", [...bundle.audios, media].slice(0, CAP.audios));
          }}
        />
      ) : null}
    </div>
  );
}

export function MediaBay() {
  const h3 = useLab((s) => s.h3);
  const patch = useLab((s) => s.patchH3);
  return (
    <MediaBayView
      bundle={{ pictures: h3.pictures, videos: h3.videos, audios: h3.audios }}
      snapTo={h3.genMode === "chunks" ? h3.chunkSec : h3.duration}
      onChange={(b) => patch(b)}
    />
  );
}

export function MiniMediaBay({
  bundle,
  onChange,
  snapTo,
  compact = true,
}: {
  bundle: MediaBundle;
  onChange: (next: MediaBundle) => void;
  snapTo?: number;
  compact?: boolean;
}) {
  return <MediaBayView bundle={bundle} onChange={onChange} snapTo={snapTo} compact={compact} />;
}

export function ImageWell({
  item,
  label,
  compact,
  accept = "image/*",
  kind = "picture",
  surfaceClass,
  onChange,
  onCrop,
  onClear,
}: {
  item?: MediaItem | null;
  label: string;
  compact?: boolean;
  accept?: string;
  kind?: "picture" | "video";
  surfaceClass?: string;
  onChange: (file: File) => void;
  onCrop?: () => void;
  onClear: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">{label}</p>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onChange(f);
        }}
        className={cn(
          "relative block w-full cursor-pointer overflow-hidden rounded-xl bg-elevated",
          compact ? "aspect-video" : "aspect-[3/4]",
          surfaceClass,
          over && "ring-1 ring-accent/50",
        )}
      >
        {item ? (
          kind === "video" ? (
            <video src={item.url} className="size-full object-cover" muted playsInline preload="metadata" />
          ) : (
            <img src={item.croppedUrl || item.url} alt="" className="size-full object-cover" />
          )
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-2 text-muted">
            <Plus className="size-5" />
            <span className="text-xs">Перетащи или выбери</span>
          </span>
        )}
        <input
          type="file"
          accept={accept}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onChange(f);
          }}
        />
      </label>
      {item ? (
        <div className="mt-2 flex gap-1">
          {onCrop ? (
            <button type="button" onClick={onCrop} className="grid size-8 place-items-center rounded-md bg-chip text-muted hover:text-fg">
              <Crop className="size-3.5" />
            </button>
          ) : null}
          <button type="button" onClick={onClear} className="grid size-8 place-items-center rounded-md bg-chip text-muted hover:text-danger">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
