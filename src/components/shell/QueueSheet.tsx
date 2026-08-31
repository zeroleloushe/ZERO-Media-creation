import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useLab } from "@/lib/store";
import { formatClock } from "@/lib/utils";
import { BAYS } from "@/lib/presets";

export function QueueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const jobs = useLab((s) => s.jobs);
  const setBay = useLab((s) => s.setBay);
  const setPreview = useLab((s) => s.setPreview);
  const clearJobs = useLab((s) => s.clearJobs);

  return (
    <Dialog open={open} onClose={onClose} title="Очередь">
      <div className="p-3">
        {jobs.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted">Пока пусто — первый прогон появится здесь.</p>
        ) : (
          <ul className="space-y-1">
            {jobs.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-elevated"
                  onClick={() => {
                    setBay(j.bay);
                    setPreview(j.bay, j.resultUrl);
                    onClose();
                  }}
                >
                  <img src={j.thumb} alt="" className="size-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {BAYS.find((b) => b.id === j.bay)?.label} · {j.note}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {j.status === "done" ? formatClock(j.durationMs) : j.status} · seed {j.seed}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {jobs.length ? (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearJobs}>
              Очистить
            </Button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
