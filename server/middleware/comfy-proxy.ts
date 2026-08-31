/**
 * Production / vite-preview reverse proxy: browser → /__comfy/* → X-Comfy-Target.
 * Dev still uses the Vite plugin; this covers `vite preview` and the Nitro build.
 */
const PREFIX = "/__comfy";

interface ProxyEvent {
  url: URL;
  req: Request;
}

function allowed(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function comfyProxyMiddleware(
  event: ProxyEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const path = event.url.pathname;
  if (!path.startsWith(PREFIX) || path === "/__comfy-ws") return next();

  const target = String(event.req.headers.get("x-comfy-target") ?? "").replace(/\/+$/, "");
  if (!target || !allowed(target)) {
    return Response.json(
      { error: "Укажи адрес Comfy, например http://127.0.0.1:8188" },
      { status: 400 },
    );
  }

  const suffix = path.slice(PREFIX.length) || "/";
  const dest = `${target}${suffix}${event.url.search}`;
  const method = (event.req.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {};
  const ct = event.req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;

  try {
    const body = method === "GET" || method === "HEAD" ? undefined : await event.req.arrayBuffer();
    const upstream = await fetch(dest, { method, headers, body });
    const out = new Headers();
    const uct = upstream.headers.get("content-type");
    if (uct) out.set("content-type", uct);
    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch (err) {
    const cause = err && typeof err === "object" ? (err as { cause?: { code?: string } }).cause : null;
    const code = cause?.code ?? "";
    const msg =
      code === "ECONNREFUSED"
        ? `Comfy не принимает соединение (${target}). Порт занят? Слушает ли 8188?`
        : code === "ENOTFOUND"
          ? `Хост не найден: ${target}`
          : err instanceof Error
            ? err.message
            : "прокси не достучался";
    return Response.json({ error: msg }, { status: 502 });
  }
}
