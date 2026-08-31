import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Chip } from "@/components/ui/group";
import { useLab } from "@/lib/store";
import type { Bay } from "@/lib/types";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function PresetBar({ bay }: { bay: Bay }) {
  const scenePresets = useLab((s) => s.scenePresets);
  const custom = scenePresets.filter((p) => p.bay === bay);
  const active = useLab((s) => s.activePreset[bay]);
  const applyPreset = useLab((s) => s.applyPreset);
  const savePreset = useLab((s) => s.savePreset);
  const deletePreset = useLab((s) => s.deletePreset);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    savePreset(bay, trimmed);
    toast(`Сохранено: ${trimmed}`);
    setName("");
    setOpen(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 p-2">
        {custom.length === 0 ? (
          <p className="px-1 py-1 text-[11px] leading-relaxed text-subtle">
            Свои пресеты: промпт, модель, LoRA, разрешение, сиды, sampler, LLM. Референсы не входят.
          </p>
        ) : null}
        {custom.map((p) => (
          <Chip
            key={p.id}
            active={active === p.id}
            onClick={() => applyPreset(p.id)}
            onDelete={() => {
              deletePreset(p.id);
              toast("Пресет удалён");
            }}
          >
            {p.name}
          </Chip>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-chip px-3 text-xs font-medium text-muted hover:text-fg"
        >
          <Plus className="size-3" />
          Сохранить
        </button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Сохранить пресет">
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-muted">
            Все крутилки этого отсека: промпт, модель, LoRA, разрешение, сиды, sampler, LLM. Референсы не входят.
          </p>
          <Input
            value={name}
            placeholder="Название пресета"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={save} disabled={!name.trim()}>
              Сохранить
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
