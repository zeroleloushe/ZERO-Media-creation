import { fetchHwStats, type HwSnapshot } from "@/lib/comfy";
import { cn } from "@/lib/utils";
import { useLab } from "@/lib/store";
import { useEffect, useState } from "react";

function gb(n: number) {
  const v = n / 1024 ** 3;
  return v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "");
}

function Meter({
  label,
  used,
  total,
}: {
  label: string;
  used: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const tone = pct >= 90 ? "bg-danger" : pct >= 75 ? "bg-accent" : "bg-accent/75";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="w-9 shrink-0 text-[10px] font-medium uppercase tracking-[0.16em] text-subtle">{label}</span>
      <div className="h-1 min-w-[48px] flex-1 overflow-hidden rounded-full bg-chip">
        <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
        {gb(used)}/{gb(total)} ГБ
      </span>
    </div>
  );
}

export function HwBar() {
  const connection = useLab((s) => s.connection);
  const comfyUrl = useLab((s) => s.comfyUrl);
  const [snap, setSnap] = useState<HwSnapshot | null>(null);

  useEffect(() => {
    if (connection !== "online" || !comfyUrl) {
      setSnap(null);
      return;
    }
    let dead = false;
    const tick = async () => {
      const next = await fetchHwStats(comfyUrl);
      if (!dead) setSnap(next);
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, [connection, comfyUrl]);

  if (connection !== "online" || !snap) return null;

  const hot = snap.tempC != null && snap.tempC >= 80;

  return (
    <div
      className="flex items-center gap-3 border-t border-line py-2"
      title={snap.gpu || "железо"}
    >
      {snap.ramTotal ? <Meter label="RAM" used={snap.ramUsed} total={snap.ramTotal} /> : null}
      {snap.vramTotal ? <Meter label="VRAM" used={snap.vramUsed} total={snap.vramTotal} /> : null}
      {snap.tempC != null ? (
        <span
          className={cn(
            "shrink-0 font-mono text-[11px] tabular-nums",
            hot ? "text-danger" : "text-muted",
          )}
        >
          {Math.round(snap.tempC)}°C
        </span>
      ) : null}
      {snap.gpu ? (
        <span className="hidden max-w-[180px] truncate text-[10px] uppercase tracking-[0.12em] text-subtle xl:inline">
          {snap.gpu}
        </span>
      ) : null}
    </div>
  );
}
