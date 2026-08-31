import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/field";
import { useLab } from "@/lib/store";
import { copyText } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatNoteDate(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notes = useLab((s) => s.notes);
  const addNote = useLab((s) => s.addNote);
  const updateNote = useLab((s) => s.updateNote);
  const deleteNote = useLab((s) => s.deleteNote);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [composing, setComposing] = useState(true);

  function save() {
    if (!title.trim() && !body.trim()) return;
    addNote(title.trim() || "Заметка", body.trim());
    setTitle("");
    setBody("");
    setComposing(false);
    toast("Заметка сохранена");
  }

  const active = !composing ? notes.find((n) => n.id === picked) : undefined;

  function insertIntoPrompt(text: string) {
    const s = useLab.getState();
    if (s.bay === "h3") s.patchH3({ prompt: s.h3.prompt ? `${s.h3.prompt}\n${text}` : text });
    else if (s.bay === "krea") s.patchKrea({ prompt: s.krea.prompt ? `${s.krea.prompt}\n${text}` : text });
    else s.patchEdit({ prompt: s.edit.prompt ? `${s.edit.prompt}\n${text}` : text, preset: "custom" });
    toast("Вставлено в промпт");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Заметки" wide>
      <div className="grid gap-3 p-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex max-h-[70dvh] flex-col gap-2">
          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              setPicked(null);
              setComposing(true);
            }}
          >
            <Plus className="size-3.5" />
            Новая
          </Button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted">Пока пусто — сохрани промпт или идею.</p>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setPicked(n.id);
                    setComposing(false);
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left ${picked === n.id && !composing ? "bg-chip" : "hover:bg-elevated"}`}
                >
                  <p className="truncate text-sm">{n.title}</p>
                  <p className="truncate text-[11px] text-muted">{n.body || "—"}</p>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {active ? (
            <>
              <Input value={active.title} onChange={(e) => updateNote(active.id, { title: e.target.value })} />
              <Textarea
                value={active.body}
                onChange={(e) => updateNote(active.id, { body: e.target.value })}
                className="min-h-48 flex-1"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-subtle">{formatNoteDate(active.createdAt)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void copyText(active.body);
                      toast("Скопировано");
                    }}
                    disabled={!active.body}
                  >
                    Копировать
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => insertIntoPrompt(active.body)}
                    disabled={!active.body}
                  >
                    В промпт
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      deleteNote(active.id);
                      setPicked(null);
                      setComposing(true);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Удалить
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Input value={title} placeholder="Заголовок" onChange={(e) => setTitle(e.target.value)} />
              <Textarea
                value={body}
                placeholder="Промпт, сид, идея кадра…"
                onChange={(e) => setBody(e.target.value)}
                className="min-h-48"
              />
              <Button variant="primary" onClick={save} disabled={!title.trim() && !body.trim()}>
                <Plus className="size-3.5" />
                Сохранить заметку
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
