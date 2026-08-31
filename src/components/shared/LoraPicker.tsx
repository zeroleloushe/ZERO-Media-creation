import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { buildLoraTree, filterTree, type LoraNode } from "@/lib/lora-tree";
import { useLab } from "@/lib/store";
import type { Bay } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, File, Folder, Search } from "lucide-react";
import { useMemo, useState } from "react";

function FolderRow({
  node,
  depth,
  used,
  open,
  toggle,
  onPick,
}: {
  node: LoraNode;
  depth: number;
  used: Set<string>;
  open: Set<string>;
  toggle: (path: string) => void;
  onPick: (file: string) => void;
}) {
  if (node.kind === "file") {
    const added = used.has(node.path);
    return (
      <button
        type="button"
        disabled={added}
        onClick={() => onPick(node.path)}
        style={{ paddingLeft: 12 + depth * 16 }}
        className={cn(
          "flex h-9 w-full items-center gap-2 pr-3 text-left text-sm",
          added ? "text-muted" : "hover:bg-chip",
        )}
      >
        <File className="size-3.5 shrink-0 text-subtle" />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {added ? <Check className="size-3.5 text-ok" /> : null}
      </button>
    );
  }
  const expanded = open.has(node.path);
  return (
    <div>
      <button
        type="button"
        onClick={() => toggle(node.path)}
        style={{ paddingLeft: 12 + depth * 16 }}
        className="flex h-10 w-full items-center gap-2 pr-3 text-left hover:bg-chip"
      >
        <ChevronRight className={cn("size-3.5 shrink-0 text-subtle transition-transform", expanded && "rotate-90")} />
        <Folder className="size-3.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-sm">{node.name}</span>
        <span className="font-mono text-[11px] tabular-nums text-subtle">{node.count}</span>
      </button>
      {expanded
        ? (node.children ?? []).map((child) => (
            <FolderRow
              key={child.path}
              node={child}
              depth={depth + 1}
              used={used}
              open={open}
              toggle={toggle}
              onPick={onPick}
            />
          ))
        : null}
    </div>
  );
}

export function LoraPicker({
  open,
  onClose,
  bay,
  used,
}: {
  open: boolean;
  onClose: () => void;
  bay: Bay;
  used: Set<string>;
}) {
  const catalog = useLab((s) => s.availableLoras);
  const addLora = useLab((s) => s.addLora);
  const [q, setQ] = useState("");
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const tree = useMemo(() => filterTree(buildLoraTree(catalog), q), [catalog, q]);

  function toggle(path: string) {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="LoRA" wide>
      <div className="flex flex-col gap-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            placeholder="Поиск по папке или файлу…"
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-[60dvh] overflow-y-auto rounded-xl bg-elevated">
          {tree.length === 0 ? (
            <p className="px-3.5 py-10 text-center text-sm text-muted">
              {catalog.length === 0
                ? "Подключи Comfy — подтянется дерево из папки loras."
                : "Ничего не найдено."}
            </p>
          ) : (
            tree.map((node) => (
              <FolderRow
                key={node.path}
                node={node}
                depth={0}
                used={used}
                open={q.trim() ? new Set(collectFolders(tree)) : openDirs}
                toggle={toggle}
                onPick={(file) => addLora(bay, file)}
              />
            ))
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          Папки как в Comfy. Кликни файл — он добавится в стек. Можно несколько подряд.
        </p>
      </div>
    </Dialog>
  );
}

function collectFolders(nodes: LoraNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.kind === "folder") {
      out.push(n.path);
      out.push(...collectFolders(n.children ?? []));
    }
  }
  return out;
}
