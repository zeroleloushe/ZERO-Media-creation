/**
 * Same-origin reverse proxy: browser → /__comfy/* → X-Comfy-Target.
 * Avoids CORS so Seamless can talk to a stock ComfyUI on 8188.
 * Hooks both `vite` (dev) and `vite preview` (prod).
 */
import { Buffer } from "node:buffer";
import net from "node:net";

export const COMFY_PROXY_PREFIX = "/__comfy";

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function isAllowedTarget(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function attachComfyProxy(server) {
  const handler = async (req, res, next) => {
    const rawUrl = req.url ?? "";
    const pathOnly = rawUrl.split("?", 1)[0] ?? "";
    if (!pathOnly.startsWith(COMFY_PROXY_PREFIX) || pathOnly === "/__comfy-ws") {
      next();
      return;
    }

    const target = String(req.headers["x-comfy-target"] ?? "").replace(/\/+$/, "");
    if (!target || !isAllowedTarget(target)) {
      res.statusCode = 400;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Укажи адрес Comfy, например http://127.0.0.1:8188" }));
      return;
    }

    const suffix = pathOnly.slice(COMFY_PROXY_PREFIX.length) || "/";
    const qs = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?")) : "";
    const dest = `${target}${suffix}${qs}`;
    const method = (req.method ?? "GET").toUpperCase();

    try {
      const headers = {};
      if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
      const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
      const upstream = await fetch(dest, {
        method,
        headers,
        body,
      });
      res.statusCode = upstream.status;
      const ct = upstream.headers.get("content-type");
      if (ct) res.setHeader("content-type", ct);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    } catch (err) {
      const cause = err && typeof err === "object" ? err.cause : null;
      const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
      const msg =
        code === "ECONNREFUSED"
          ? `Comfy не принимает соединение (${target}). Порт занят? Слушает ли 8188?`
          : code === "ENOTFOUND"
            ? `Хост не найден: ${target}`
            : err instanceof Error
              ? err.message
              : "прокси не достучался";
      res.statusCode = 502;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: msg }));
    }
  };

  return () => {
    server.middlewares.use(handler);
    const stack = server.middlewares.stack;
    if (stack.length > 1) {
      const last = stack.pop();
      stack.unshift(last);
    }
    server.httpServer?.on("upgrade", (req, socket, head) => {
      const raw = req.url ?? "";
      const pathOnly = raw.split("?", 1)[0] ?? "";
      if (pathOnly !== "/__comfy-ws") return;
      const u = new URL(raw, "http://localhost");
      const target = u.searchParams.get("target") || "";
      const clientId = u.searchParams.get("clientId") || "";
      if (!isAllowedTarget(target)) {
        socket.destroy();
        return;
      }
      let dest;
      try {
        dest = new URL(target);
      } catch {
        socket.destroy();
        return;
      }
      const port = Number(dest.port || (dest.protocol === "https:" ? 443 : 80));
      const host = dest.hostname;
      const wsPath = `/ws?clientId=${encodeURIComponent(clientId)}`;
      const proxy = net.connect(port, host, () => {
        const key = req.headers["sec-websocket-key"];
        const ver = req.headers["sec-websocket-version"] || "13";
        proxy.write(
          `GET ${wsPath} HTTP/1.1\r\n` +
            `Host: ${host}:${port}\r\n` +
            `Upgrade: websocket\r\n` +
            `Connection: Upgrade\r\n` +
            `Sec-WebSocket-Version: ${ver}\r\n` +
            `Sec-WebSocket-Key: ${key}\r\n` +
            `Origin: ${dest.protocol}//${host}:${port}\r\n` +
            `\r\n`,
        );
        if (head?.length) proxy.write(head);
        proxy.pipe(socket);
        socket.pipe(proxy);
      });
      proxy.on("error", () => socket.destroy());
      socket.on("error", () => proxy.destroy());
    });
  };
}

export function comfyProxyPlugin() {
  return {
    name: "seamless-comfy-proxy",
    apply: "serve",
    configureServer: attachComfyProxy,
    configurePreviewServer: attachComfyProxy,
  };
}
