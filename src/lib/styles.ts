export type StyleEntry = {
  id: string;
  name: string;
  prompt: string;
  negative?: string;
  custom?: boolean;
};

export function styleSnippet(prompt: string) {
  return prompt
    .replace(/\{prompt\}/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:]+|[\s,.;:]+$/g, "")
    .trim();
}

export function mergePrompt(current: string, snippet: string, where: "start" | "end") {
  const a = current.trim();
  const b = snippet.trim();
  if (!b) return a;
  if (!a) return b;
  return where === "start" ? `${b}, ${a}` : `${a}, ${b}`;
}

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let cache: StyleEntry[] | null = null;

export async function loadFooocusStyles(): Promise<StyleEntry[]> {
  if (cache) return cache;
  const res = await fetch("/styles/fooocus.json");
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    id?: string;
    name?: string;
    prompt?: string;
    negative?: string;
    negative_prompt?: string;
  }>;
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  cache = data.flatMap((raw) => {
    const name = String(raw.name ?? "").trim();
    if (!name) return [];
    const prompt = String(raw.prompt ?? "").trim();
    const negative = String(raw.negative ?? raw.negative_prompt ?? "").trim();
    if (!prompt && !negative) return [];
    let id = raw.id || slug(name);
    let n = 2;
    while (seen.has(id)) {
      id = `${slug(name)}-${n}`;
      n += 1;
    }
    seen.add(id);
    return [{ id, name, prompt: prompt || negative, negative: negative || undefined }];
  });
  return cache;
}
