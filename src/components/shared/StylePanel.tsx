import { Fold } from "@/components/shared/Fold";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/field";
import { loadFooocusStyles, mergePrompt, styleSnippet, type StyleEntry } from "@/lib/styles";
import { useLab } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

export function StylePanel({
  prompt,
  onPrompt,
  fooocus = true,
}: {
  prompt: string;
  onPrompt: (next: string) => void;
  fooocus?: boolean;
}) {
  const custom = useLab((s) => s.customStyles);
  const addStyle = useLab((s) => s.addStyle);
  const deleteStyle = useLab((s) => s.deleteStyle);
  const [builtin, setBuiltin] = useState<StyleEntry[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!fooocus) {
      setBuiltin([]);
      return;
    }
    void loadFooocusStyles().then(setBuiltin);
  }, [fooocus]);

  const needle = q.trim().toLowerCase();
  const mine = useMemo(() => {
    const list = custom.map((s) => ({ ...s, custom: true as const }));
    if (!needle) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.prompt.toLowerCase().includes(needle) ||
        (s.negative ?? "").toLowerCase().includes(needle),
    );
  }, [custom, needle]);
  const fooocusList = useMemo(() => {
    if (!fooocus) return [] as StyleEntry[];
    if (!needle) return builtin;
    return builtin.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.prompt.toLowerCase().includes(needle) ||
        (s.negative ?? "").toLowerCase().includes(needle),
    );
  }, [builtin, fooocus, needle]);

  function apply(s: StyleEntry, where: "start" | "end") {
    const snip = styleSnippet(s.prompt);
    if (!snip) return;
    onPrompt(mergePrompt(prompt, snip, where));
    toast(where === "start" ? `Стиль в начало: ${s.name}` : `Стиль в конец: ${s.name}`);
  }

  return (
    <>
    <Fold title="Стили" hint={fooocus ? "Fooocus и свои" : "Только свои"} defaultOpen={false}>
      <div className="flex flex-col gap-2 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <Input value={q} placeholder="Поиск стиля…" onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className={cn("overflow-y-auto rounded-xl bg-bg", fooocus ? "max-h-80" : "max-h-56")}>
          {mine.length === 0 && fooocusList.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">
              {fooocus ? "Ничего не найдено." : "Пока нет своих стилей. Сохрани текущий промпт."}
            </p>
          ) : (
            <>
              {mine.length > 0 && fooocus ? <SectionLabel>Мои · {mine.length}</SectionLabel> : null}
              {mine.map((s) => (
                <StyleRow
                  key={s.id}
                  style={s}
                  open={openId === s.id}
                  onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                  onApply={apply}
                  onDelete={() => deleteStyle(s.id)}
                />
              ))}
              {fooocusList.length > 0 ? <SectionLabel>Fooocus · {fooocusList.length}</SectionLabel> : null}
              {fooocusList.map((s) => (
                <StyleRow
                  key={s.id}
                  style={s}
                  open={openId === s.id}
                  onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                  onApply={apply}
                />
              ))}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setBody(prompt);
            setSaveOpen(true);
          }}
          className="flex h-9 items-center justify-center gap-1 rounded-full bg-chip text-xs text-muted hover:text-fg"
        >
          <Plus className="size-3.5" />
          Сохранить стиль
        </button>
      </div>
    </Fold>
      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} title="Новый стиль">
        <div className="flex flex-col gap-3 p-5">
          <Input value={name} placeholder="Название" onChange={(e) => setName(e.target.value)} autoFocus />
          <Textarea
            value={body}
            placeholder="Промпт стиля"
            onChange={(e) => setBody(e.target.value)}
            className="min-h-28"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim() || !body.trim()}
              onClick={() => {
                addStyle(name.trim(), body.trim());
                toast("Стиль сохранён");
                setName("");
                setBody("");
                setSaveOpen(false);
              }}
            >
              Сохранить
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="sticky top-0 z-10 bg-bg/95 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-subtle backdrop-blur-sm">
      {children}
    </p>
  );
}

function StyleRow({
  style: s,
  open,
  onToggle,
  onApply,
  onDelete,
}: {
  style: StyleEntry;
  open: boolean;
  onToggle: () => void;
  onApply: (s: StyleEntry, where: "start" | "end") => void;
  onDelete?: () => void;
}) {
  const snip = styleSnippet(s.prompt);
  return (
    <div className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-1 pr-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-chip"
        >
          <ChevronDown className={cn("size-3.5 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
          <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
          {s.custom ? <span className="text-[10px] uppercase tracking-wider text-accent">свой</span> : null}
        </button>
        <button
          type="button"
          className="h-7 shrink-0 rounded-full bg-chip px-2 text-[11px] text-muted hover:text-fg"
          onClick={() => onApply(s, "start")}
        >
          В начало
        </button>
        <button
          type="button"
          className="h-7 shrink-0 rounded-full bg-accent px-2 text-[11px] font-medium text-accent-fg"
          onClick={() => onApply(s, "end")}
        >
          В конец
        </button>
      </div>
      {open ? (
        <div className="space-y-2 px-3 pb-3">
          <p className="text-xs leading-relaxed text-muted">{snip || "—"}</p>
          {s.negative ? (
            <p className="text-[11px] leading-relaxed text-subtle">
              <span className="uppercase tracking-wider">Neg · </span>
              {s.negative}
            </p>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-danger"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
              Удалить
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
