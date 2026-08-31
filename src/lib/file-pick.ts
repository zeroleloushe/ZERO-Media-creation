/** One hidden file input on document.body. Survives React remounts; same gesture as a normal picker on desktop. */

let input: HTMLInputElement | null = null;
let pending: ((files: File[]) => void) | null = null;

function ensureInput() {
  if (typeof document === "undefined") return null;
  if (input?.isConnected) return input;
  const el = document.createElement("input");
  el.type = "file";
  el.tabIndex = -1;
  el.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;opacity:0";
  document.body.appendChild(el);
  input = el;
  return el;
}

export function pickFiles(opts?: { accept?: string; multiple?: boolean }): Promise<File[]> {
  const el = ensureInput();
  if (!el) return Promise.resolve([]);
  if (pending) {
    const prev = pending;
    pending = null;
    prev([]);
  }
  el.accept = opts?.accept || "";
  el.multiple = Boolean(opts?.multiple);
  el.value = "";
  return new Promise((resolve) => {
    const finish = (files: File[]) => {
      if (pending !== finish) return;
      pending = null;
      el.removeEventListener("change", onChange);
      resolve(files);
    };
    const onChange = () => finish(Array.from(el.files ?? []));
    pending = finish;
    el.addEventListener("change", onChange);
    el.click();
  });
}
