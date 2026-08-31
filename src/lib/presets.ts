import type { LoraItem, RatioPreset, ScenePreset } from "./types";

export const BAYS = [
  { id: "h3" as const, label: "H3", hint: "Видео" },
  { id: "krea" as const, label: "Krea", hint: "Кадр" },
  { id: "edit" as const, label: "Edit", hint: "Редактура" },
  { id: "upscale" as const, label: "Upscale Video", hint: "Видео" },
];

export const H3_DURATIONS = [5, 6, 8, 10, 12, 15];

export const H3_RATIOS: RatioPreset[] = [
  { id: "1:1", label: "1:1", w: 768, h: 768 },
  { id: "16:9", label: "16:9", w: 1280, h: 704 },
  { id: "9:16", label: "9:16", w: 704, h: 1280 },
  { id: "4:3", label: "4:3", w: 1024, h: 768 },
  { id: "3:2", label: "3:2", w: 1152, h: 768 },
  { id: "2:3", label: "2:3", w: 768, h: 1152 },
  { id: "21:9", label: "21:9", w: 1280, h: 544 },
  { id: "5:2", label: "5:2", w: 1280, h: 512 },
  { id: "custom", label: "Своё", w: 1024, h: 480 },
];

export const KREA_RATIOS: RatioPreset[] = [
  { id: "1:1", label: "1:1", w: 1024, h: 1024 },
  { id: "2:3", label: "2:3", w: 1152, h: 1728 },
  { id: "3:2", label: "3:2", w: 1728, h: 1152 },
  { id: "3:4", label: "3:4", w: 1152, h: 1536 },
  { id: "4:3", label: "4:3", w: 1536, h: 1152 },
  { id: "9:16", label: "9:16", w: 1088, h: 1920 },
  { id: "16:9", label: "16:9", w: 1920, h: 1088 },
  { id: "21:9", label: "21:9", w: 1920, h: 832 },
  { id: "custom", label: "Своё", w: 1152, h: 1728 },
];

export const CROP_ASPECTS = [
  { id: "free", label: "Свободно" },
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "2:3", label: "2:3" },
  { id: "3:2", label: "3:2" },
  { id: "21:9", label: "21:9" },
  { id: "output", label: "Как генерация" },
];

export const H3_LORAS: LoraItem[] = [
  { id: "turbo", name: "Turbo 8-step", file: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors", on: false, strength: 1 },
  { id: "vbvr", name: "VBVR attn", file: "Minimax H3\\VBVR_H3_attn_only.safetensors", on: false, strength: 1 },
  { id: "moawxx", name: "moawxx", file: "Minimax H3\\moawxx_000002750.safetensors", on: false, strength: 0.75 },
  { id: "vagassist", name: "vagassist", file: "Minimax H3\\HMPussy - PussyAnus LoRA\\vagassist_e40.safetensors", on: false, strength: 1 },
  { id: "galaxy", name: "GalaxyAce", file: "Minimax H3\\H3-GalaxyAce.safetensors", on: false, strength: 0.85 },
];

export const KREA_LORAS: LoraItem[] = [
  { id: "gpt2", name: "gpt2 style", file: "Krea 2\\Ps_gpt2-style_v3-krea2.safetensors", on: false, strength: 0.7 },
  { id: "masterpieces", name: "masterpieces v51", file: "Krea 2\\krea2-masterpieces-v51.safetensors", on: false, strength: 0.75 },
  { id: "prettycake", name: "prettycake", file: "Krea 2\\prettycake_epoch_7.safetensors", on: true, strength: 1 },
  { id: "realism", name: "realism engine", file: "Krea 2\\realism_engine_krea2_v3.1.safetensors", on: true, strength: 0.75 },
  { id: "bloom", name: "bloomgirls 4k", file: "Krea 2\\bloomgirls-ultrarealism-krea2_4k.safetensors", on: true, strength: 0.8 },
  { id: "textfusion", name: "textfusion", file: "Krea 2\\Krea2_TextFusion_Refusal_Reduction.safetensors", on: false, strength: 1 },
  { id: "niji", name: "gradeXniji", file: "Krea 2\\gradeXnijiKrea2_00004.safetensors", on: true, strength: 0.55 },
  { id: "lenovo", name: "lenovo", file: "Krea 2\\lenovo_krea2.safetensors", on: false, strength: 0.85 },
  { id: "tooncore", name: "tooncore", file: "Krea 2\\tooncore_-_tags_krea_epoch_8.safetensors", on: false, strength: 0.85 },
  { id: "aumirage", name: "aumirage", file: "Krea 2\\aumirageV2.safetensors", on: false, strength: 0.3 },
  { id: "zero", name: "Zeroleloushe", file: "Krea 2\\ZeroLeloushe\\Zeroleloushe_krea2.safetensors", on: false, strength: 1.25 },
  { id: "kroma", name: "kroma", file: "Krea 2\\kroma-v0.1.safetensors", on: false, strength: 1 },
  { id: "posing", name: "posing dynamics", file: "Krea 2\\PosingDynamics-Krea2.safetensors", on: false, strength: 0.55 },
];

export const EDIT_LORAS: LoraItem[] = [
  { id: "identity", name: "identity edit", file: "Krea 2\\krea2_identity_edit_v1_2_r128.safetensors", on: true, strength: 1, hidden: true },
  { id: "realism", name: "realism engine", file: "Krea 2\\realism_engine_krea2_v3.1.safetensors", on: false, strength: 0.8 },
  { id: "cinematic", name: "cinematic shot", file: "Krea 2\\zy_Cinematic_Shot_K2.safetensors", on: false, strength: 1 },
  { id: "lenovo", name: "lenovo", file: "Krea 2\\lenovo_krea2.safetensors", on: false, strength: 0.9 },
  { id: "bloom", name: "bloomgirls 4k", file: "Krea 2\\bloomgirls-ultrarealism-krea2_4k.safetensors", on: true, strength: 0.65 },
  { id: "textfusion", name: "textfusion", file: "Krea 2\\Krea2_TextFusion_Refusal_Reduction.safetensors", on: true, strength: 1 },
  { id: "gpt2", name: "gpt2 style", file: "Krea 2\\Ps_gpt2-style_v3-krea2.safetensors", on: false, strength: 0.65 },
  { id: "masterpieces", name: "masterpieces v51", file: "Krea 2\\krea2-masterpieces-v51.safetensors", on: false, strength: 0.75 },
];

export const STYLES = [
  { id: "none", label: "Без стиля", triggers: "", loras: [] as string[] },
  { id: "prettycake", label: "prettycake", triggers: "@prettycake, masterpiece, very aesthetic", loras: ["prettycake"] },
  { id: "tooncore", label: "tooncore", triggers: "tooncore, masterpiece", loras: ["tooncore"] },
  { id: "niji", label: "gradeXniji", triggers: "gradeXniji_style", loras: ["niji"] },
  { id: "gpt2", label: "gpt2", triggers: "gpt2, m1V8", loras: ["gpt2"] },
  { id: "cinematic", label: "Cinematic", triggers: "zy_cinematic, cinematic shot, anamorphic, film grain", loras: ["cinematic"] },
  { id: "realism", label: "Realism", triggers: "photoreal, natural skin, studio lighting", loras: ["realism", "bloom"] },
  { id: "bloom", label: "Bloom", triggers: "bloom, subsurface scattering", loras: ["bloom"] },
  { id: "zero", label: "Zeroleloushe", triggers: "", loras: ["zero"] },
];

export const LLM_MODELS = [
  "Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf",
  "Huihui-Qwen3.5-9B-abliterated.Q5_K_M.gguf",
  "Huihui-Qwen3.5-9B-abliterated.Q8_0.gguf",
];

export const MMPROJ_MODELS = [
  "Huihui-Qwen3.5-9B-abliterated.mmproj-Q8_0.gguf",
];

export const UNET_MODELS = [
  "h3ErosMax_beta3.safetensors",
  "krea2_turbo_int8_convrot.safetensors",
];

export const SAMPLERS = ["er_sde", "euler", "euler_ancestral", "dpmpp_2m", "dpmpp_sde", "exp_heun_2_x0_sde"];
export const SCHEDULERS = ["simple", "beta", "sgm_uniform", "karras", "normal"];
export const REASONING = ["off", "low", "medium", "high"];
export const SYSTEM_PROMPTS = [
  "Zero - ImagePromt 18 test.txt",
  "default.txt",
  "character-sheet.txt",
];

export const H3_PROMPT_PRESETS = [
  { id: "blank", label: "Пустой" },
  { id: "platform", label: "Платформа" },
  { id: "talking", label: "Talking-head" },
  { id: "memory", label: "Memory-cut" },
];

export const H3_PRESET_TEXT: Record<string, string> = {
  platform: `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

subject_definitions:
<Picture 1> is the first frame of [Shot 1].
<Picture 2> is the multi-panel character reference sheet for <Subject 1>.
<Subject 1> is the woman whose identity is taken from <Picture 2> and whose opening pose is taken from <Picture 1>.

summary:
[keyframe completion + reference generation] A 10-second ultra-widescreen cinematic piece. <Picture 1> is the exact first frame. <Picture 2> locks identity.

detailed_description:
Live-action photorealistic cinema in ultra-widescreen 21:9. Cool wet overcast grade. Fine film grain, shallow depth.
[Shot 1] Opens exactly on <Picture 1>. Hold, then push in slowly toward her eye.
[Shot 2] Continue the moment. Smoke, rain, the train receding.

overall_soundscape:
Light rain, train-wheel rumble, cigarette paper. No spoken words.`,
  talking: `<Audio 1> is the voice-timbre reference for <Subject 1> (S1), containing a spoken vocal layer.

summary:
[reference generation + audio reference] The target video shows <Subject 1> speaking a greeting directly to the camera, using <Audio 1> as the voice-timbre reference for <Subject 1> (S1).

overall_soundscape:
footsteps and light ambience remain clearly audible at a consistent, moderate volume throughout, including during the spoken line, without dipping into near-silence or being heavily ducked under the dialogue.`,
  memory: `For the target video, at 0.00 seconds, <Picture 1> is fully referenced as the first frame. <Picture 2> locks <Subject 1> identity in every shot.

summary:
A cinematic memory montage: present-tense opening on the reference still, rapid cuts through remembered interiors, smash-cut return to the opening frame.

retention_analysis:
<Picture 1>: fully_preserved as first and last frame.
<Picture 2>: fully_preserved identity across all shots.`,
};

export const VOICE_HINT = `<Audio 1> — тембр голоса для <Subject 1>. В summary укажи [reference generation + audio reference] и что персонаж говорит, используя <Audio 1> как voice-timbre. Саундскейп не должен проваливаться в тишину на реплике.`;

export const EDIT_PRESETS = [
  { id: "custom", label: "Сцена" },
  { id: "card", label: "Карточка" },
  { id: "card-style", label: "Карточка + стиль" },
  { id: "from-card", label: "Из карточки" },
];

export const EDIT_PRESET_TEXT: Record<string, string> = {
  custom: `Use the reference image only to extract the character identity.

The reference contains multiple views of ONE character. These views are NOT part of the final image.

Generate a new image with ONLY ONE character.
Do not include the reference sheet, additional poses, duplicates, clones, or multiple versions.

Keep the exact same face, hairstyle, outfit, body proportions and details from the reference.

Create the following scene:

`,
  card: `You are generating ONE image that looks exactly like the reference photo.

This image contains 5 separate photographs of the same person, arranged in a grid.

TOP HALF of the image = 3 photos side by side (equal width, equal height)
BOTTOM HALF of the image = 2 photos side by side (equal width, equal height)
Every photo has a thin black border around it.
All 5 photos have pure black background.

PHOTO 1 — top-left: Full body. FRONT VIEW. Arms hang straight down. Looks into the camera.
PHOTO 2 — top-center: Full body. RIGHT SIDE VIEW. Pure profile.
PHOTO 3 — top-right: Full body. BACK VIEW.
CRITICAL: same size and head/feet alignment across photos 1–3. The person only rotates.

PHOTO 4 — bottom-left: CLOSE-UP FRONT. Top of head to collarbone.
PHOTO 5 — bottom-right: CLOSE-UP PROFILE. Same scale as Photo 4.

Copy the person from the reference exactly. Same face, hair, clothing, accessories. Studio softbox lighting. Sharp focus.`,
  "card-style": `You are generating ONE image that is a 5-panel character turnaround sheet of the SAME person from the reference image.

CRITICAL STYLE RULE
Match the exact artistic style of the reference image.
Same medium. Same rendering. Same line quality. Same shading. Same color treatment.
Do NOT convert the image to photorealism unless the reference is already photoreal.

LAYOUT
TOP HALF = 3 panels: front, right profile, back. Full body, arms down.
BOTTOM HALF = 2 panels: front close-up and right-profile close-up, head to collarbone.
Thin black borders. Pure black background. Same scale across 1–3 and across 4–5.

Copy face, hair, clothing and accessories exactly. Use the same lighting logic as the reference.`,
  "from-card": `Use the reference image only to extract the character identity.

The reference contains multiple views of ONE character. These views are NOT part of the final image.

Generate a new image with ONLY ONE character.
Do not include the reference sheet, additional poses, duplicates, clones, or multiple versions.

Keep the exact same face, hairstyle, outfit, body proportions and details from the reference.

Create the following scene:

A girl is sitting on an expensive sports bike in front of a nighttime Tokyo skyline, posing for a photo.`,
};

export const UPSCALED_KREA_PROMPT =
  "Enhance and upscale the provided image to maximum high-resolution 4K quality while preserving the original image exactly.";

export function ratioOf(list: RatioPreset[], id: string): RatioPreset {
  return list.find((r) => r.id === id) ?? list[0];
}

export function aspectValue(id: string, fallback?: { w: number; h: number }): number | null {
  if (id === "free") return null;
  if (id === "output" && fallback) return fallback.w / fallback.h;
  const [a, b] = id.split(":").map(Number);
  if (!a || !b) return null;
  return a / b;
}

export function loraLabel(file: string) {
  const base = file.split(/[/\\]/).pop() ?? file;
  return base.replace(/\.safetensors$/i, "");
}

export function defaultLoraCatalog() {
  const files = [...H3_LORAS, ...KREA_LORAS, ...EDIT_LORAS].map((l) => l.file);
  return [...new Set(files)];
}

export const BUILTIN_PRESETS: ScenePreset[] = [
  { id: "h3-blank", bay: "h3", name: "Пустой", builtin: true, payload: { prompt: "" } },
  { id: "h3-platform", bay: "h3", name: "Платформа", builtin: true, payload: { prompt: H3_PRESET_TEXT.platform } },
  { id: "h3-talking", bay: "h3", name: "Talking-head", builtin: true, payload: { prompt: H3_PRESET_TEXT.talking } },
  { id: "h3-memory", bay: "h3", name: "Memory-cut", builtin: true, payload: { prompt: H3_PRESET_TEXT.memory } },
  { id: "edit-custom", bay: "edit", name: "Сцена", builtin: true, payload: { prompt: EDIT_PRESET_TEXT.custom, preset: "custom" } },
  { id: "edit-card", bay: "edit", name: "Карточка", builtin: true, payload: { prompt: EDIT_PRESET_TEXT.card, preset: "card" } },
  { id: "edit-card-style", bay: "edit", name: "Карточка + стиль", builtin: true, payload: { prompt: EDIT_PRESET_TEXT["card-style"], preset: "card-style" } },
  { id: "edit-from-card", bay: "edit", name: "Из карточки", builtin: true, payload: { prompt: EDIT_PRESET_TEXT["from-card"], preset: "from-card" } },
];
