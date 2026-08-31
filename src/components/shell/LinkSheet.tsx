import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { normalizeComfyUrl, DEFAULT_COMFY_URL } from "@/lib/comfy";
import { refreshLink } from "@/lib/run";
import { useLab } from "@/lib/store";
import { copyText } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function LinkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const comfyUrl = useLab((s) => s.comfyUrl);
  const setComfyUrl = useLab((s) => s.setComfyUrl);
  const connection = useLab((s) => s.connection);
  const info = useLab((s) => s.linkInfo);
  const [local, setLocal] = useState(comfyUrl);
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setLocal(comfyUrl);
  }, [comfyUrl, open]);

  useEffect(() => {
    if (typeof window !== "undefined") setPageUrl(window.location.href);
  }, [open]);

  const qr = useMemo(() => {
    if (!pageUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=09090b&color=f4f4f5&data=${encodeURIComponent(pageUrl)}`;
  }, [pageUrl]);

  async function save() {
    const url = normalizeComfyUrl(local);
    setComfyUrl(url);
    if (!url) {
      useLab.getState().setConnection("demo", {});
      toast("Демо-режим");
      return;
    }
    await refreshLink();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Связь">
      <div className="space-y-5 p-5">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">Адрес ComfyUI</p>
          <Input
            value={local}
            placeholder={DEFAULT_COMFY_URL}
            onChange={(e) => setLocal(e.target.value)}
          />
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Обычно <span className="font-mono text-fg">http://127.0.0.1:8188</span>. Панель ходит в Comfy через
            свой сервер — CORS не нужен. С телефона тот же адрес, если Comfy на этом ПК.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-elevated px-3.5 py-3">
          <div>
            <p className="text-sm">
              {connection === "online"
                ? "На связи"
                : connection === "checking"
                  ? "Проверка…"
                  : connection === "offline"
                    ? "Нет связи"
                    : "Демо"}
            </p>
            <p className="text-xs text-muted">
              {info.gpu ? `${info.gpu}${info.vram ? ` · ${info.vram}` : ""}` : info.error || "Очередь имитируется локально"}
            </p>
          </div>
          <span
            className={
              connection === "online"
                ? "size-2 rounded-full bg-ok"
                : connection === "offline"
                  ? "size-2 rounded-full bg-danger"
                  : "size-2 rounded-full bg-accent"
            }
          />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => void save()}>
            Подключить
          </Button>
          <Button
            variant="subtle"
            onClick={() => {
              setLocal("");
              setComfyUrl("");
              useLab.getState().setConnection("demo", {});
            }}
          >
            Демо
          </Button>
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
            Открыть на телефоне
          </p>
          <div className="flex items-start gap-4">
            {qr ? (
              <img src={qr} alt="QR" width={132} height={132} className="rounded-lg bg-bg" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="break-all text-xs text-muted">{pageUrl}</p>
              <Button
                variant="subtle"
                size="sm"
                className="mt-3"
                onClick={async () => {
                  await copyText(pageUrl);
                  setCopied(true);
                  toast("Ссылка скопирована");
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check /> : <Copy />}
                Копировать
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
