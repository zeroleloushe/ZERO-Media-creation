import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MediaLightbox } from "@/components/shared/MediaLightbox";
import { getGalleryUrl } from "@/lib/gallery-db";
import { BAYS } from "@/lib/presets";
import { sendVideoToUpscale } from "@/lib/run";
import { useLab } from "@/lib/store";
import type { Bay, Job } from "@/lib/types";
import { cn, formatClock } from "@/lib/utils";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string) {
  const today = dayKey(Date.now());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return "Сегодня";
  if (key === dayKey(y.getTime())) return "Вчера";
  return key;
}

function jobWhen(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bayLabel(bay: Bay) {
  return BAYS.find((b) => b.id === bay)?.label ?? bay;
}

export function GallerySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const jobs = useLab((s) => s.jobs);
  const setBay = useLab((s) => s.setBay);
  const setPreview = useLab((s) => s.setPreview);
  const patchH3 = useLab((s) => s.patchH3);
  const patchKrea = useLab((s) => s.patchKrea);
  const patchEdit = useLab((s) => s.patchEdit);
  const patchUpscale = useLab((s) => s.patchUpscale);
  const [bay, setFilter] = useState<Bay | "all">("all");
  const [day, setDay] = useState<string>("all");
  const [picked, setPicked] = useState<Job | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setPicked(null);
      return;
    }
    let gone = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const j of jobs) {
        if (j.resultUrl && !j.resultUrl.startsWith("blob:")) next[j.id] = j.resultUrl;
        else {
          const u = await getGalleryUrl(j.id);
          if (u) next[j.id] = u;
          else if (j.resultUrl) next[j.id] = j.resultUrl;
        }
      }
      if (!gone) setUrls(next);
    })();
    return () => {
      gone = true;
    };
  }, [open, jobs]);

  const days = useMemo(() => {
    const keys = [...new Set(jobs.map((j) => dayKey(j.createdAt)))].sort().reverse();
    return keys;
  }, [jobs]);

  const visible = jobs.filter((j) => {
    if (j.status !== "done" && j.status !== "error" && j.status !== "interrupted") return true;
    if (bay !== "all" && j.bay !== bay) return false;
    if (day !== "all" && dayKey(j.createdAt) !== day) return false;
    return true;
  });

  function reuse(j: Job) {
    setBay(j.bay);
    if (j.bay === "h3") patchH3({ prompt: j.prompt, seed: j.seed });
    if (j.bay === "krea") patchKrea({ prompt: j.prompt, seedImage: j.seed });
    if (j.bay === "edit") patchEdit({ prompt: j.prompt, seed: j.seed });
    if (j.bay === "upscale") patchUpscale({ prompt: j.prompt, seed: j.seed });
    const url = urls[j.id] || j.resultUrl;
    setPreview(j.bay, url);
    setPicked(null);
    onClose();
  }

  const pickedUrl = picked ? urls[picked.id] || picked.resultUrl : "";

  return (
    <Dialog open={open} onClose={onClose} title="Галерея" wide="xl">
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          {([{ id: "all", label: "Все" }, ...BAYS] as { id: string; label: string }[]).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setFilter(b.id as Bay | "all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                bay === b.id ? "bg-accent text-bg" : "bg-chip text-muted hover:text-fg",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDay("all")}
            className={cn("rounded-full px-3 py-1 text-xs", day === "all" ? "bg-fg text-bg" : "bg-chip text-muted")}
          >
            Все дни
          </button>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={cn("rounded-full px-3 py-1 text-xs", day === d ? "bg-fg text-bg" : "bg-chip text-muted")}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">Пока пусто.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {visible.map((j) => {
              const src = urls[j.id] || j.thumb;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setPicked(j)}
                  className="group relative overflow-hidden rounded-xl bg-elevated text-left"
                >
                  {j.kind === "video" ? (
                    <video src={src} className="aspect-[4/3] w-full object-cover" muted />
                  ) : (
                    <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg/80 to-transparent px-2 py-1.5">
                    <p className="truncate text-[11px] text-fg">
                      {bayLabel(j.bay)}
                      {j.upscale ? " · up" : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {picked && pickedUrl
        ? createPortal(
            <MediaLightbox
              url={pickedUrl}
              kind={picked.kind}
              label={bayLabel(picked.bay)}
              onClose={() => setPicked(null)}
              footer={
                <JobMeta
                  job={picked}
                  onReuse={() => reuse(picked)}
                  onPreview={() => {
                    setBay(picked.bay);
                    setPreview(picked.bay, pickedUrl);
                    setPicked(null);
                    onClose();
                  }}
                  onUpscale={
                    picked.kind === "video"
                      ? () => {
                          void sendVideoToUpscale(pickedUrl, "gallery.mp4");
                          setPicked(null);
                          onClose();
                        }
                      : undefined
                  }
                />
              }
            />,
            document.body,
          )
        : null}
    </Dialog>
  );
}

function JobMeta({
  job,
  onReuse,
  onPreview,
  onUpscale,
}: {
  job: Job;
  onReuse: () => void;
  onPreview: () => void;
  onUpscale?: () => void;
}) {
  const chips = [
    bayLabel(job.bay),
    job.upscale ? "апскейл" : null,
    job.ratio,
    job.steps != null ? `${job.steps} шагов` : null,
    `seed ${job.seed}`,
    job.unet,
    job.durationMs ? formatClock(job.durationMs) : null,
    jobWhen(job.createdAt),
    job.status === "error" ? "ошибка" : job.status === "interrupted" ? "стоп" : null,
    job.note,
  ].filter(Boolean) as string[];

  return (
    <div className="flex max-h-[40dvh] flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded-full bg-chip px-2.5 py-0.5 font-mono text-[11px] text-muted">
            {c}
          </span>
        ))}
      </div>
      <div className="min-h-0 overflow-auto rounded-lg bg-elevated px-3 py-2">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{job.prompt || "Промпт не сохранён"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onReuse}>
          Повторить
        </Button>
        <Button size="sm" variant="subtle" onClick={onPreview}>
          В превью
        </Button>
        {onUpscale ? (
          <Button size="sm" variant="subtle" onClick={onUpscale}>
            В апскейл
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(job.prompt || String(job.seed));
            toast("Скопировано");
          }}
        >
          <Copy className="size-3.5" />
          Промпт
        </Button>
      </div>
    </div>
  );
}