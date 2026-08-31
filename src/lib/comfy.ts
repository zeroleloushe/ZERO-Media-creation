import type { ConnectionStatus, LinkInfo, ModelCatalog } from "./types";

export const DEFAULT_COMFY_URL = "http://127.0.0.1:8188";

export function normalizeComfyUrl(raw: string) {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) return `http://${t}`;
  return t;
}

async function comfyFetch(base: string, path: string, init: RequestInit = {}) {
  const target = normalizeComfyUrl(base);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init.headers);
  headers.set("X-Comfy-Target", target);
  return fetch(`/__comfy${suffix}`, { ...init, headers });
}

export async function parseComfyError(res: Response) {
  try {
    const j = (await res.json()) as {
      error?: string | { message?: string; type?: string; details?: string };
      node_errors?: Record<string, { class_type?: string; errors?: { message?: string; details?: string }[] }>;
    };
    const parts: string[] = [];
    if (typeof j.error === "string") parts.push(j.error);
    else if (j.error?.message) parts.push(j.error.message + (j.error.details ? ` — ${j.error.details}` : ""));
    if (j.node_errors) {
      for (const [id, n] of Object.entries(j.node_errors)) {
        for (const er of n.errors ?? []) {
          parts.push(`${n.class_type || id}: ${er.message || er.details || "ошибка"}`);
        }
      }
    }
    if (parts.length) return parts.slice(0, 4).join("\n");
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

async function throwIfBad(res: Response) {
  if (res.ok) return;
  throw new Error(await parseComfyError(res));
}

export async function pingComfy(url: string): Promise<{ status: ConnectionStatus; info: LinkInfo }> {
  const base = normalizeComfyUrl(url);
  if (!base) return { status: "demo", info: {} };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await comfyFetch(base, "/system_stats", { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { status: "offline", info: { error: await parseComfyError(res) } };
    const data = (await res.json()) as {
      devices?: { name?: string; vram_total?: number }[];
    };
    const gpu = data.devices?.[0];
    return {
      status: "online",
      info: {
        gpu: gpu?.name ?? "ComfyUI",
        vram: gpu?.vram_total ? `${Math.round(gpu.vram_total / 1024 / 1024 / 1024)} ГБ` : undefined,
      },
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      status: "offline",
      info: {
        error: aborted
          ? "Таймаут — панель не достучалась до Comfy за 6 с"
          : err instanceof Error
            ? err.message
            : "нет связи",
      },
    };
  }
}

export async function queuePrompt(url: string, prompt: unknown, clientId: string) {
  const res = await comfyFetch(url, "/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, client_id: clientId }),
  });
  await throwIfBad(res);
  return (await res.json()) as { prompt_id: string };
}

export async function fetchHistory(url: string, promptId: string) {
  const res = await comfyFetch(url, `/history/${promptId}`);
  await throwIfBad(res);
  return res.json() as Promise<Record<string, ComfyHistoryItem>>;
}

export async function interruptPrompt(url: string) {
  const res = await comfyFetch(url, "/interrupt", { method: "POST" });
  if (!res.ok && res.status !== 200) throw new Error(await parseComfyError(res));
}

export async function freeComfyMemory(url: string) {
  const res = await comfyFetch(url, "/free", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unload_models: true, free_memory: true }),
  });
  await throwIfBad(res);
}

async function listFolder(url: string, folder: string): Promise<string[]> {
  const res = await comfyFetch(url, `/models/${folder}`);
  if (!res.ok) return [];
  try {
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? data.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function comboOptions(info: unknown, classType: string, input: string): string[] {
  const root = info && typeof info === "object" ? (info as Record<string, unknown>)[classType] : null;
  const node = root && typeof root === "object" ? (root as Record<string, unknown>) : null;
  const inputs = node && typeof node.input === "object" ? (node.input as Record<string, unknown>) : null;
  const req = inputs && typeof inputs.required === "object" ? (inputs.required as Record<string, unknown>) : {};
  const opt = inputs && typeof inputs.optional === "object" ? (inputs.optional as Record<string, unknown>) : {};
  const spec = (req[input] ?? opt[input]) as unknown;
  if (spec && typeof spec === "object" && !Array.isArray(spec)) {
    const opts = (spec as { options?: unknown }).options;
    if (Array.isArray(opts)) return opts.filter((x): x is string => typeof x === "string");
  }
  if (!Array.isArray(spec) || spec.length === 0) return [];
  const first = spec[0];
  if (Array.isArray(first)) return first.filter((x): x is string => typeof x === "string");
  const meta = spec[1];
  if (meta && typeof meta === "object" && Array.isArray((meta as { options?: unknown }).options)) {
    return ((meta as { options: unknown[] }).options).filter((x): x is string => typeof x === "string");
  }
  return [];
}

function uniq(items: string[]) {
  return [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b, "en"));
}

export type { ModelCatalog } from "./types";

export async function fetchComfyCatalog(url: string): Promise<ModelCatalog> {
  const [
    unet,
    diffusion,
    llmLower,
    llmCap,
    llmProc,
    llmFolder,
    textEnc,
    clip,
    mmproj,
    samplerInfo,
    llmInfo,
    unetInfo,
    upInfo,
  ] = await Promise.all([
    listFolder(url, "unet"),
    listFolder(url, "diffusion_models"),
    listFolder(url, "llms"),
    listFolder(url, "LLM"),
    listFolder(url, "llm_text_processor_models"),
    listFolder(url, "llm"),
    listFolder(url, "text_encoders"),
    listFolder(url, "clip"),
    listFolder(url, "mmproj"),
    comfyFetch(url, "/object_info/KSampler").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    comfyFetch(url, "/object_info/LLMTextProcessor").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    comfyFetch(url, "/object_info/UNETLoader").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    comfyFetch(url, "/object_info/MinimaxH3LatentUpscaler3D").then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const fromInfoModel = comboOptions(llmInfo, "LLMTextProcessor", "model").filter(
    (n) => n && !/^no gguf/i.test(n) && !/no models found/i.test(n),
  );
  const fromInfoMmproj = comboOptions(llmInfo, "LLMTextProcessor", "mmproj");
  const fromFolders = [...llmProc, ...llmCap, ...llmFolder, ...llmLower, ...textEnc.filter((f) => /\.gguf$/i.test(f))];
  const fromUnetCombo = comboOptions(unetInfo, "UNETLoader", "unet_name").filter(
    (n) => n && !/^no /i.test(n) && !/not found/i.test(n),
  );
  const unets = uniq([...diffusion, ...unet, ...fromUnetCombo]);
  const llms = uniq([
    ...fromInfoModel,
    ...fromFolders.filter((f) => !/mmproj/i.test(f.split(/[/\\]/).pop() || f)),
  ]);
  const mmprojs = uniq([
    ...fromInfoMmproj,
    ...mmproj,
    ...clip.filter((f) => /mmproj/i.test(f)),
    ...fromFolders.filter((f) => /mmproj/i.test(f.split(/[/\\]/).pop() || f)),
  ]);
  const samplers = comboOptions(samplerInfo, "KSampler", "sampler_name");
  const schedulers = comboOptions(samplerInfo, "KSampler", "scheduler");
  const systemPrompts = comboOptions(llmInfo, "LLMTextProcessor", "system_prompt");
  const upscaleModels = comboOptions(upInfo, "MinimaxH3LatentUpscaler3D", "model_name");
  return { unet: unets, llm: llms, mmproj: mmprojs, systemPrompts, samplers, schedulers, upscaleModels };
}


export async function fetchComfyLoras(url: string): Promise<string[]> {
  const res = await comfyFetch(url, "/models/loras");
  if (!res.ok) throw new Error(await parseComfyError(res));
  const data = (await res.json()) as unknown;
  if (Array.isArray(data)) return data.filter((x): x is string => typeof x === "string");
  return [];
}

export async function uploadToComfy(url: string, blob: Blob, filename: string) {
  const file = new File([blob], filename);
  const fd = new FormData();
  fd.append("image", file);
  fd.append("overwrite", "true");
  fd.append("type", "input");
  const res = await comfyFetch(url, "/upload/image", { method: "POST", body: fd });
  await throwIfBad(res);
  const j = (await res.json()) as { name?: string };
  return j.name || filename;
}

export async function fetchViewBlob(url: string, file: ComfyFile) {
  const q = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder || "",
    type: file.type || "output",
  });
  const res = await comfyFetch(url, `/view?${q.toString()}`);
  await throwIfBad(res);
  return res.blob();
}

export type ComfyFile = { filename: string; subfolder?: string; type?: string };

export type ComfyHistoryItem = {
  status?: { status_str?: string; completed?: boolean; messages?: unknown[] };
  outputs?: Record<string, unknown>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function historyItem(raw: unknown, promptId: string): ComfyHistoryItem | null {
  const r = asRecord(raw);
  if (!r) return null;
  if (asRecord(r[promptId])) return r[promptId] as ComfyHistoryItem;
  if (r.outputs) return r as ComfyHistoryItem;
  return null;
}

function collectFiles(value: unknown, into: ComfyFile[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    if (typeof value[0] === "string" && /\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i.test(value[0])) {
      into.push({
        filename: value[0],
        subfolder: typeof value[1] === "string" ? value[1] : "",
        type: typeof value[2] === "string" ? value[2] : "output",
      });
      return;
    }
    for (const x of value) collectFiles(x, into);
    return;
  }
  const o = asRecord(value);
  if (!o) return;
  if (typeof o.filename === "string") {
    into.push({
      filename: o.filename,
      subfolder: typeof o.subfolder === "string" ? o.subfolder : "",
      type: typeof o.type === "string" ? o.type : "output",
    });
    return;
  }
  for (const v of Object.values(o)) collectFiles(v, into);
}

function kindOf(name: string): "image" | "video" {
  return /\.(mp4|webm|mov)$/i.test(name) ? "video" : "image";
}

export function pickOutput(
  item: ComfyHistoryItem,
  preferNode = "seamless_save",
  preferKind?: "image" | "video",
): { file: ComfyFile; kind: "image" | "video" } | null {
  const outs = asRecord(item.outputs) ?? {};
  const ids = Object.keys(outs);
  const order = preferNode && outs[preferNode] ? [preferNode, ...ids.filter((k) => k !== preferNode)] : ids;
  const files: ComfyFile[] = [];
  for (const id of order) collectFiles(outs[id], files);
  const wanted = preferKind
    ? files.find((f) => kindOf(f.filename) === preferKind)
    : files.find((f) => kindOf(f.filename) === "image");
  const hit = wanted ?? files.find((f) => kindOf(f.filename) === "video") ?? files[0];
  if (!hit) return null;
  return { file: hit, kind: kindOf(hit.filename) };
}

async function fetchJson(url: string, path: string) {
  const res = await comfyFetch(url, path);
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function queueHas(raw: unknown, promptId: string) {
  const r = asRecord(raw);
  if (!r) return false;
  const rows = [...(Array.isArray(r.queue_running) ? r.queue_running : []), ...(Array.isArray(r.queue_pending) ? r.queue_pending : [])];
  return rows.some((row) => Array.isArray(row) && row[1] === promptId);
}

export async function waitForPrompt(
  url: string,
  promptId: string,
  onTick: (progress: number) => void,
  timeoutMs = 15 * 60_000,
  signal?: AbortSignal,
) {
  const t0 = Date.now();
  let last: ComfyHistoryItem | null = null;
  while (Date.now() - t0 < timeoutMs) {
    if (signal?.aborted) throw new Error("Прервано");
    const queue = await fetchJson(url, "/queue");
    const inQueue = queueHas(queue, promptId);
    const scoped = await fetchJson(url, `/history/${encodeURIComponent(promptId)}`);
    last = historyItem(scoped, promptId);
    if (!last) {
      const all = await fetchJson(url, "/history?max_items=64");
      last = historyItem(all, promptId);
    }
    const st = last?.status?.status_str;
    if (st === "error") throw new Error("Comfy вернул ошибку выполнения");
    const picked = last ? pickOutput(last) : null;
    if (last && picked && (!inQueue || last.status?.completed || st === "success")) return last;
    if (!inQueue && last && (last.status?.completed || st === "success")) return last;
    if (!inQueue && last && Date.now() - t0 > 2500) return last;
    const elapsed = Date.now() - t0;
    // Idle heartbeat only — live sampler progress comes from the websocket.
    onTick(Math.min(12, 4 + elapsed / 30_000));
    await new Promise((r) => setTimeout(r, 900));
  }
  if (last) return last;
  throw new Error("Таймаут ожидания Comfy");
}

