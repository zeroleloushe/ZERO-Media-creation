import { Dialog } from "@/components/ui/dialog";
import installMd from "@/content/install.md?raw";
import { cn } from "@/lib/utils";
import { useMemo, type ReactNode } from "react";

function inlineFmt(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={k++} className="font-medium text-fg">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k++} className="rounded bg-chip px-1 py-0.5 font-mono text-[12px] text-accent">{tok.slice(1, -1)}</code>);
    else {
      const mk = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mk) {
        out.push(
          <a key={k++} href={mk[2]} target="_blank" rel="noreferrer" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
            {mk[1]}
          </a>,
        );
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function tocFrom(md: string) {
  return md
    .split("\n")
    .filter((l) => /^##\s+\d/.test(l) || /^##\s+/.test(l))
    .map((l) => {
      const title = l.replace(/^##\s+/, "").trim();
      const id = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
      return { title, id };
    });
}

function renderMd(md: string) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim() === "---") {
      i += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre key={k++} className="overflow-x-auto rounded-xl bg-bg px-4 py-3 font-mono text-[12px] leading-relaxed text-accent/90">
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        if (!cells.every((c) => /^[-:]+$/.test(c))) rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const head = rows[0];
        const body = rows.slice(1);
        blocks.push(
          <div key={k++} className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-chip/60 text-[11px] uppercase tracking-[0.12em] text-subtle">
                <tr>
                  {head.map((c, ci) => (
                    <th key={ci} className="px-3 py-2 font-medium">
                      {inlineFmt(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((r, ri) => (
                  <tr key={ri} className="border-t border-line">
                    {r.map((c, ci) => (
                      <td key={ci} className="px-3 py-2 align-top text-muted">
                        {inlineFmt(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }
    if (/^###\s+/.test(line)) {
      blocks.push(
        <h3 key={k++} className="pt-2 text-[15px] font-medium text-fg">
          {inlineFmt(line.replace(/^###\s+/, ""))}
        </h3>,
      );
      i += 1;
      continue;
    }
    if (/^##\s+/.test(line)) {
      const title = line.replace(/^##\s+/, "").trim();
      const id = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
      blocks.push(
        <h2 key={k++} id={id} className="scroll-mt-4 border-b border-line pb-2 pt-6 text-[13px] font-medium uppercase tracking-[0.18em] text-accent">
          {title}
        </h2>,
      );
      i += 1;
      continue;
    }
    if (/^#\s+/.test(line)) {
      i += 1;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={k++} className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          {items.map((it, ii) => (
            <li key={ii}>{inlineFmt(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={k++} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          {items.map((it, ii) => (
            <li key={ii}>{inlineFmt(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    const buf: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s+|```|\||---|[-*]\s+|\d+\.\s+)/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={k++} className="text-sm leading-relaxed text-muted">
        {inlineFmt(buf.join(" "))}
      </p>,
    );
  }
  return blocks;
}

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toc = useMemo(() => tocFrom(installMd), []);
  const body = useMemo(() => renderMd(installMd), []);

  return (
    <Dialog open={open} onClose={onClose} title="Справка" wide="xl">
      <div className="grid min-h-0 flex-1 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden max-h-[80dvh] overflow-y-auto border-r border-line p-3 md:block">
          <p className="px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-subtle">Содержание</p>
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={cn(
                "block rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-chip hover:text-fg",
              )}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {t.title}
            </a>
          ))}
        </nav>
        <article className="flex max-h-[80dvh] flex-col gap-3 overflow-y-auto p-5 md:p-6">
          <p className="font-medium tracking-[0.16em] text-accent">ZERO · Media creation</p>
          {body}
        </article>
      </div>
    </Dialog>
  );
}
