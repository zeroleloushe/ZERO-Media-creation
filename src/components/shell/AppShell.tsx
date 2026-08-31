import { EditWorkspace } from "@/components/edit/EditWorkspace";
import { H3Workspace } from "@/components/h3/H3Workspace";
import { KreaWorkspace } from "@/components/krea/KreaWorkspace";
import { UpscaleWorkspace } from "@/components/upscale/UpscaleWorkspace";
import { GallerySheet } from "@/components/shell/GallerySheet";
import { LinkSheet } from "@/components/shell/LinkSheet";
import { NotesSheet } from "@/components/shared/NotesSheet";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/group";
import { BAYS } from "@/lib/presets";
import { exportCurrent, interruptBay, refreshLink, runBay } from "@/lib/run";
import { DEFAULT_COMFY_URL, freeComfyMemory, normalizeComfyUrl } from "@/lib/comfy";
import { useLab } from "@/lib/store";
import type { Bay } from "@/lib/types";
import { isBay } from "@/lib/types";
import { copyText, downloadText, formatClock } from "@/lib/utils";
import { Clapperboard, Download, Images, Link2, MemoryStick, Square, StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";

let autoLinked = false;

export function AppShell() {
  const bay = useLab((s) => s.bay);
  const setBay = useLab((s) => s.setBay);
  const connection = useLab((s) => s.connection);
  const runningId = useLab((s) => s.runningId);
  const elapsed = useLab((s) => s.elapsedMs);
  const comfyUrl = useLab((s) => s.comfyUrl);
  const jobs = useLab((s) => s.jobs);
  const running = jobs.find((j) => j.id === runningId);
  const [linkOpen, setLinkOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [freeing, setFreeing] = useState(false);

  useEffect(() => {
    const boot = async () => {
      if (autoLinked) return;
      autoLinked = true;
      if (!useLab.persist.hasHydrated()) await useLab.persist.rehydrate();
      const params = new URLSearchParams(window.location.search);
      const c = params.get("comfy");
      const b = params.get("bay") as Bay | null;
      if (c) useLab.getState().setComfyUrl(normalizeComfyUrl(c));
      else if (!useLab.getState().comfyUrl.trim()) {
        useLab.getState().setComfyUrl(DEFAULT_COMFY_URL);
      }
      if (isBay(b)) setBay(b);
      await refreshLink();
    };
    void boot();
  }, [setBay]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("bay") === bay) return;
    url.searchParams.set("bay", bay);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [bay]);

  async function exportJson() {
    const g = await exportCurrent(bay);
    downloadText(`zero-${bay}.json`, JSON.stringify(g, null, 2));
    toast("JSON скачан");
  }

  async function copyJson() {
    const g = await exportCurrent(bay);
    await copyText(JSON.stringify({ prompt: g }));
    toast("Payload скопирован");
  }

  const busy = Boolean(running);

  async function clearMemory() {
    if (busy) {
      toast.error("Сначала останови прогон");
      return;
    }
    if (connection !== "online" || !comfyUrl) {
      toast.error("Сначала подключи Comfy");
      return;
    }
    setFreeing(true);
    try {
      await freeComfyMemory(comfyUrl);
      toast.success("Память очищена · модели выгружены");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось выгрузить модели");
    } finally {
      setFreeing(false);
    }
  }

  const iconTools = (
    <>
      <Button variant="ghost" size="icon-sm" disabled={busy || freeing} onClick={() => void clearMemory()} aria-label="Очистить память">
        <MemoryStick />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => setNotesOpen(true)} aria-label="Заметки">
        <StickyNote />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => setGalleryOpen(true)} aria-label="Галерея">
        <Images />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => void exportJson()} aria-label="Скачать JSON">
        <Download />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => void copyJson()} aria-label="Копировать payload">
        <Clapperboard />
      </Button>
      <Button variant="subtle" size="icon-sm" onClick={() => setLinkOpen(true)} aria-label={comfyUrl ? "Связь" : "Подключить"}>
        <Link2 />
      </Button>
    </>
  );

  const desktopTools = (
    <>
      <Button variant="ghost" size="sm" disabled={busy || freeing} onClick={() => void clearMemory()} aria-label="Очистить память">
        <MemoryStick />
        <span className="hidden xl:inline">{freeing ? "Чищу…" : "Память"}</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setNotesOpen(true)} aria-label="Заметки">
        <StickyNote />
        <span className="hidden xl:inline">Заметки</span>
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => setGalleryOpen(true)} aria-label="Галерея">
        <Images />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => void exportJson()} aria-label="Скачать JSON">
        <Download />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => void copyJson()} aria-label="Копировать payload">
        <Clapperboard />
      </Button>
      <Button variant="subtle" size="sm" onClick={() => setLinkOpen(true)}>
        <Link2 />
        <span className="hidden xl:inline">{comfyUrl ? "Связь" : "Подключить"}</span>
      </Button>
    </>
  );

  return (
    <div className="grain flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-col lg:h-[72px] lg:flex-row lg:items-center lg:gap-2 lg:px-4">
          <div className="flex h-12 min-w-0 items-center gap-2 px-3 lg:h-auto lg:flex-1 lg:px-0">
            <div className="flex min-w-0 shrink-0 flex-col justify-center leading-none">
              <span className="text-[15px] font-semibold tracking-[0.16em] text-accent lg:text-[16px]">ZERO</span>
              <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.22em] text-muted lg:mt-1.5 lg:text-[9px]">
                Media creation
              </span>
            </div>
            <div className="mx-auto hidden min-w-0 flex-1 justify-center lg:flex lg:max-w-[520px]">
              <Segmented value={bay} onChange={setBay} options={BAYS} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <div className="mr-1 hidden items-center gap-2 font-mono text-xs tabular-nums text-muted lg:flex">
                {runningId ? (
                  <>
                    <span className="size-1.5 animate-[safelight_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
                    {formatClock(elapsed)}
                  </>
                ) : (
                  <span>{connection === "online" ? "Comfy" : "Демо"}</span>
                )}
              </div>
              {busy ? (
                <Button
                  variant="danger"
                  size="lg"
                  className="h-10 min-w-0 px-4 text-sm font-semibold lg:h-12 lg:min-w-[124px] lg:px-6 lg:text-base"
                  onClick={() => void interruptBay()}
                >
                  <Square className="size-3 fill-current" />
                  Стоп
                </Button>
              ) : (
                <Button
                  variant="accent"
                  size="lg"
                  className="h-10 min-w-0 px-5 text-sm font-semibold shadow-[0_0_28px_rgb(196_165_116_/_0.5)] lg:h-12 lg:min-w-[124px] lg:px-7 lg:text-base"
                  onClick={() => void runBay(bay)}
                >
                  Пуск
                </Button>
              )}
              <div className="hidden items-center gap-1 lg:flex">{desktopTools}</div>
            </div>
          </div>
          <div className="flex items-center justify-around gap-0.5 border-t border-line px-1 py-1 lg:hidden">
            {iconTools}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-y-auto px-4 py-4 lg:overflow-hidden">
        {bay === "h3" ? <H3Workspace /> : null}
        {bay === "krea" ? <KreaWorkspace /> : null}
        {bay === "edit" ? <EditWorkspace /> : null}
        {bay === "upscale" ? <UpscaleWorkspace /> : null}
      </main>

      <nav className="z-30 border-t border-line bg-bg/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="flex gap-2">
          {busy ? (
            <Button variant="danger" size="lg" className="flex-1 text-base font-semibold" onClick={() => void interruptBay()}>
              Стоп
            </Button>
          ) : (
            <>
              <Button variant="accent" size="lg" className="flex-1 text-base font-semibold shadow-[0_0_24px_rgb(196_165_116_/_0.4)]" onClick={() => void runBay(bay)}>
                Пуск
              </Button>
            </>
          )}
        </div>
        <div className="mt-2">
          <Segmented value={bay} onChange={setBay} options={BAYS} />
        </div>
      </nav>

      <LinkSheet open={linkOpen} onClose={() => setLinkOpen(false)} />
      <GallerySheet open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      <NotesSheet open={notesOpen} onClose={() => setNotesOpen(false)} />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#17171a",
            color: "#f4f4f5",
            border: "1px solid rgb(255 255 255 / 0.08)",
          },
        }}
      />
    </div>
  );
}
