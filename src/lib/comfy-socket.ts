import { normalizeComfyUrl } from "./comfy";

function sniffImage(buf: ArrayBuffer): Blob | null {
  const bytes = new Uint8Array(buf);
  const find = (start: number, limit = 64) => {
    const end = Math.min(start + limit, Math.max(start, bytes.length - 2));
    for (let i = start; i <= end; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) return new Blob([buf.slice(i)], { type: "image/jpeg" });
      if (bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x47) {
        return new Blob([buf.slice(i)], { type: "image/png" });
      }
      if (bytes[i] === 0x52 && bytes[i + 1] === 0x49 && bytes[i + 2] === 0x46 && bytes[i + 3] === 0x46) {
        const tag = String.fromCharCode(bytes[i + 8] || 0, bytes[i + 9] || 0, bytes[i + 10] || 0, bytes[i + 11] || 0);
        if (tag === "WEBP") return new Blob([buf.slice(i)], { type: "image/webp" });
      }
    }
    return null;
  };
  const direct = find(0);
  if (direct) return direct;
  if (buf.byteLength < 8) return null;
  const view = new DataView(buf);
  for (const le of [false, true]) {
    const event = view.getUint32(0, le);
    if (event === 1 || event === 2) {
      const sniffed = find(8);
      if (sniffed) return sniffed;
      const imageType = view.getUint32(4, le);
      const mime = imageType === 2 ? "image/png" : imageType === 3 ? "image/webp" : "image/jpeg";
      if (buf.byteLength > 16) return new Blob([buf.slice(8)], { type: mime });
    }
    if (event === 4) {
      const metaLen = view.getUint32(4, le);
      if (metaLen > 0 && metaLen < buf.byteLength - 8) {
        const start = 8 + metaLen;
        const sniffed = find(start);
        if (sniffed) return sniffed;
        if (buf.byteLength > start + 16) return new Blob([buf.slice(start)], { type: "image/jpeg" });
      }
    }
  }
  return find(8, bytes.length);
}

function asBuffer(data: unknown): ArrayBuffer | null {
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Blob) return null;
  if (ArrayBuffer.isView(data)) {
    const v = data as ArrayBufferView;
    return Uint8Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)).buffer;
  }
  return null;
}

function b64ToBlob(raw: string, mime: string): Blob | null {
  try {
    const trimmed = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    const bin = atob(trimmed);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    if (arr.length < 32) return null;
    return new Blob([arr], { type: mime || "image/jpeg" });
  } catch {
    return null;
  }
}

function socketUrls(httpUrl: string, clientId: string) {
  const target = normalizeComfyUrl(httpUrl);
  const qs = new URLSearchParams({ target, clientId });
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const proxy = `${proto}//${window.location.host}/__comfy-ws?${qs.toString()}`;
  const direct = `${target.replace(/^http/i, "ws")}/ws?clientId=${encodeURIComponent(clientId)}`;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  return local ? [proxy, direct] : [proxy];
}

type SocketHooks = {
  onPreview: (blob: Blob, meta?: { fps?: number; mime?: string; step?: number; total?: number }) => void;
  onProgress?: (value: number, max: number) => void;
  onStatus?: (text: string) => void;
  onError?: (message: string) => void;
};

export function openComfySocket(httpUrl: string, clientId: string, hooks: SocketHooks) {
  let ws: WebSocket | null = null;
  let stopped = false;
  let resolveReady: () => void = () => {};
  let haveSamplerProgress = false;
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });

  const handleMessage = (ev: MessageEvent) => {
    if (ev.data instanceof Blob) {
      void ev.data.arrayBuffer().then((buf) => {
        const blob = sniffImage(buf);
        if (blob && blob.size > 32) hooks.onPreview(blob);
      });
      return;
    }
    const buf = asBuffer(ev.data);
    if (buf) {
      const blob = sniffImage(buf);
      if (blob && blob.size > 32) hooks.onPreview(blob);
      return;
    }
    if (typeof ev.data !== "string") return;
    try {
      const msg = JSON.parse(ev.data) as {
        type?: string;
        data?: {
          value?: number;
          max?: number;
          node?: string | null;
          exception_message?: string;
          sid?: string;
          nodes?: Record<string, { value?: number; max?: number }>;
          image?: string;
          mime?: string;
          step?: number;
          total?: number;
          node_id?: string;
          fps?: number;
        };
      };
      if (msg.type === "kj_preview_override") {
        const raw = msg.data?.image;
        if (typeof raw === "string" && raw.length > 32) {
          const mime = typeof msg.data?.mime === "string" ? msg.data.mime : "image/jpeg";
          const blob = b64ToBlob(raw, mime);
          if (blob) {
            hooks.onPreview(blob, {
              mime,
              fps: typeof msg.data?.fps === "number" ? msg.data.fps : undefined,
              step: Number(msg.data?.step) || undefined,
              total: Number(msg.data?.total) || undefined,
            });
          }
        }
        if (!haveSamplerProgress) {
          const total = Number(msg.data?.total) || 0;
          const step = Number(msg.data?.step);
          if (total > 0 && Number.isFinite(step)) {
            const value = step >= total ? total : step + 1;
            hooks.onProgress?.(Math.min(value, total), total);
          }
        }
        return;
      }
      if (msg.type === "progress" && msg.data?.max) {
        haveSamplerProgress = true;
        hooks.onProgress?.(Number(msg.data.value) || 0, Number(msg.data.max) || 1);
        return;
      }
      if (msg.type === "progress_state" && msg.data?.nodes && !haveSamplerProgress) {
        const nodes = Object.values(msg.data.nodes);
        const sampler = nodes
          .filter((n) => (n.max || 0) > 1)
          .sort((a, b) => (b.max || 0) - (a.max || 0))[0];
        if (sampler?.max) hooks.onProgress?.(Number(sampler.value) || 0, Number(sampler.max) || 1);
        return;
      }
      if (msg.type === "executing") {
        hooks.onStatus?.(msg.data?.node ? "сэмплинг" : "сборка кадра");
        return;
      }
      if (msg.type === "execution_error") {
        hooks.onError?.(msg.data?.exception_message || "ошибка выполнения");
      }
    } catch {
      /* ignore */
    }
  };

  const tryConnect = (urls: string[], i: number) => {
    if (stopped || i >= urls.length) {
      resolveReady();
      return;
    }
    const sock = new WebSocket(urls[i]);
    sock.binaryType = "arraybuffer";
    const fail = () => {
      if (stopped || ws) return;
      try {
        sock.close();
      } catch {
        /* ignore */
      }
      tryConnect(urls, i + 1);
    };
    sock.addEventListener("open", () => {
      if (stopped) {
        sock.close();
        return;
      }
      ws = sock;
      hooks.onStatus?.("waiting for sample…");
      resolveReady();
    });
    sock.addEventListener("error", fail);
    sock.addEventListener("close", () => {
      if (ws === sock) ws = null;
    });
    sock.addEventListener("message", handleMessage);
    window.setTimeout(() => {
      if (sock.readyState !== WebSocket.OPEN) fail();
    }, 1500);
  };

  tryConnect(socketUrls(httpUrl, clientId), 0);

  return {
    ready,
    stop() {
      stopped = true;
      resolveReady();
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    },
  };
}
