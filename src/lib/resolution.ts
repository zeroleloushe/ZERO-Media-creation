export const ASPECTS = [
  { id: "1:1", a: 1, b: 1 },
  { id: "16:9", a: 16, b: 9 },
  { id: "9:16", a: 9, b: 16 },
  { id: "2:1", a: 2, b: 1 },
  { id: "3:2", a: 3, b: 2 },
  { id: "2:3", a: 2, b: 3 },
  { id: "4:3", a: 4, b: 3 },
  { id: "3:4", a: 3, b: 4 },
  { id: "4:5", a: 4, b: 5 },
  { id: "21:9", a: 21, b: 9 },
  { id: "5:2", a: 5, b: 2 },
] as const;

export const SNAP_STEPS = [0, 8, 16, 32, 64] as const;

export type ResMode = "preset" | "custom_ratio" | "custom_res";

export interface ResInput {
  ratio: string;
  megapixels: number;
  snap: number;
  resMode?: ResMode;
  customW?: number;
  customH?: number;
  customRw?: number;
  customRh?: number;
}

export function parseAspect(id: string): { a: number; b: number } {
  const found = ASPECTS.find((x) => x.id === id);
  if (found) return { a: found.a, b: found.b };
  const [a, b] = id.split(":").map(Number);
  return { a: a || 1, b: b || 1 };
}

export function computeResolution(opts: ResInput): { w: number; h: number; mp: number } {
  const mode = opts.resMode ?? "preset";
  let w: number;
  let h: number;
  if (mode === "custom_res") {
    w = Math.max(1, opts.customW || 1024);
    h = Math.max(1, opts.customH || 1024);
  } else {
    const { a, b } =
      mode === "custom_ratio"
        ? { a: Math.max(1, opts.customRw || 1), b: Math.max(1, opts.customRh || 1) }
        : parseAspect(opts.ratio);
    const pixels = Math.max(0.05, opts.megapixels || 1) * 1_000_000;
    const ar = a / b;
    w = Math.sqrt(pixels * ar);
    h = Math.sqrt(pixels / ar);
  }
  const snap = opts.snap > 0 ? opts.snap : 0;
  if (snap) {
    w = Math.max(snap, Math.round(w / snap) * snap);
    h = Math.max(snap, Math.round(h / snap) * snap);
  } else {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
  }
  return { w, h, mp: (w * h) / 1_000_000 };
}
