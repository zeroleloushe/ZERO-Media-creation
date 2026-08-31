import { loraLabel } from "./presets";

export type LoraNode = {
  name: string;
  path: string;
  kind: "folder" | "file";
  count?: number;
  children?: LoraNode[];
};

export function splitLoraPath(file: string) {
  return file.replace(/\\/g, "/").split("/").filter(Boolean);
}

export function folderOf(file: string) {
  const parts = splitLoraPath(file);
  return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "";
}

type Dir = { name: string; files: string[]; dirs: Map<string, Dir>; trail: string[] };

function countFiles(dir: Dir): number {
  let n = dir.files.length;
  for (const child of dir.dirs.values()) n += countFiles(child);
  return n;
}

function toNodes(dir: Dir): LoraNode[] {
  const folders: LoraNode[] = [...dir.dirs.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((d) => ({
      name: d.name,
      path: d.trail.join("/"),
      kind: "folder" as const,
      count: countFiles(d),
      children: toNodes(d),
    }));
  const files: LoraNode[] = dir.files
    .slice()
    .sort((a, b) => loraLabel(a).localeCompare(loraLabel(b), "en"))
    .map((f) => ({ name: loraLabel(f), path: f, kind: "file" as const }));
  return [...folders, ...files];
}

export function buildLoraTree(files: string[]): LoraNode[] {
  const root: Dir = { name: "", files: [], dirs: new Map(), trail: [] };
  for (const file of files) {
    const parts = splitLoraPath(file);
    if (parts.length <= 1) {
      root.files.push(file);
      continue;
    }
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const n = parts[i];
      if (!cur.dirs.has(n)) {
        cur.dirs.set(n, { name: n, files: [], dirs: new Map(), trail: [...cur.trail, n] });
      }
      cur = cur.dirs.get(n)!;
    }
    cur.files.push(file);
  }
  return toNodes(root);
}

export function filterTree(nodes: LoraNode[], needle: string): LoraNode[] {
  const q = needle.trim().toLowerCase();
  if (!q) return nodes;
  const walk = (list: LoraNode[]): LoraNode[] => {
    const out: LoraNode[] = [];
    for (const n of list) {
      if (n.kind === "file") {
        if (n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)) out.push(n);
        continue;
      }
      const kids = walk(n.children ?? []);
      if (n.name.toLowerCase().includes(q) || kids.length) {
        out.push({ ...n, children: kids, count: kids.filter((k) => k.kind === "file").length || n.count });
      }
    }
    return out;
  };
  return walk(nodes);
}
