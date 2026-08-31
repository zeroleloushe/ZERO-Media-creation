export type Bay = "h3" | "krea" | "edit" | "upscale";

export type MediaKind = "picture" | "video" | "audio";

export type ConnectionStatus = "demo" | "checking" | "online" | "offline";

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
  aspect: string;
}

export interface MediaItem {
  id: string;
  kind: MediaKind;
  name: string;
  url: string;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  crop?: CropRect;
  croppedUrl?: string;
  trimStart: number;
  trimLength: number;
}

export interface LoraItem {
  id: string;
  name: string;
  file: string;
  on: boolean;
  strength: number;
  hidden?: boolean;
}

export interface RatioPreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

export interface Job {
  id: string;
  bay: Bay;
  createdAt: number;
  durationMs: number;
  thumb: string;
  resultUrl: string;
  kind: "image" | "video";
  seed: number;
  prompt: string;
  status: "running" | "done" | "error" | "interrupted";
  progress: number;
  note?: string;
  upscale?: boolean;
  ratio?: string;
  steps?: number;
  unet?: string;
}

export interface MediaBundle {
  pictures: MediaItem[];
  videos: MediaItem[];
  audios: MediaItem[];
}

export interface H3State {
  prompt: string;
  llm: boolean;
  duration: number;
  ratio: string;
  customW: number;
  customH: number;
  customRw: number;
  customRh: number;
  genMp: number;
  snap: number;
  resMode: "preset" | "custom_ratio" | "custom_res";
  seed: number;
  loras: LoraItem[];
  audioFromPixaroma: boolean;
  pixaromaAudio?: MediaItem | null;
  pictures: MediaItem[];
  videos: MediaItem[];
  audios: MediaItem[];
  upscale: boolean;
  denoise: number;
  megapixels: number;
  upscaleRatio: string;
  upscaleSnap: number;
  chunks: number;
  upscaleModel: string;
  steps: number;
  sampler: string;
  scheduler: string;
  unet: string;
  llmModel: string;
  mmproj: string;
  reasoning: string;
  systemPrompt: string;
  seedLlm: number;
  genMode: "standard" | "chunks";
  chunkSec: number;
  chunkCount: number;
  chunkPrompts: string[];
  refMode: "shared" | "per_chunk";
  chunkRefs: MediaBundle[];
}

export interface UpscaleState {
  prompt: string;
  source: MediaItem | null;
  pictures: MediaItem[];
  megapixels: number;
  snap: number;
  chunks: number;
  denoise: number;
  steps: number;
  sampler: string;
  scheduler: string;
  seed: number;
  unet: string;
  upscaleModel: string;
  loras: LoraItem[];
  useH3Latent?: boolean;
}

export interface KreaState {
  prompt: string;
  extraPrompt: string;
  triggerWords: string;
  llmEnhance: boolean;
  triggerOn: boolean;
  extraOn: boolean;
  loraOn: boolean;
  styleOn: boolean;
  styleId: string;
  styleIds: string[];
  reasoning: string;
  systemPrompt: string;
  llmModel: string;
  mmproj: string;
  unet: string;
  steps: number;
  sampler: string;
  scheduler: string;
  seedImage: number;
  seedLlm: number;
  ratio: string;
  customW: number;
  customH: number;
  customRw: number;
  customRh: number;
  megapixels: number;
  snap: number;
  resMode: "preset" | "custom_ratio" | "custom_res";
  upscale: boolean;
  denoise: number;
  upscaleBy: number;
  upscaleMp: number;
  upscaleSnap: number;
  loadImage?: MediaItem | null;
  loras: LoraItem[];
}

export interface EditState {
  prompt: string;
  preset: string;
  matchSource: boolean;
  ratio: string;
  customW: number;
  customH: number;
  customRw: number;
  customRh: number;
  megapixels: number;
  snap: number;
  resMode: "preset" | "custom_ratio" | "custom_res";
  seed: number;
  styleOn: boolean;
  styleId: string;
  styleIds: string[];
  upscale: boolean;
  denoise: number;
  upscaleBy: number;
  image1?: MediaItem | null;
  image2?: MediaItem | null;
  loras: LoraItem[];
}

export interface ModelCatalog {
  unet: string[];
  llm: string[];
  mmproj: string[];
  systemPrompts: string[];
  samplers: string[];
  schedulers: string[];
  upscaleModels: string[];
}

export interface LinkInfo {
  gpu?: string;
  vram?: string;
  error?: string;
}

export interface ScenePreset {
  id: string;
  bay: Bay;
  name: string;
  builtin?: boolean;
  payload: Record<string, unknown>;
}

export interface NoteCard {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

export interface CustomStyle {
  id: string;
  name: string;
  prompt: string;
  negative?: string;
  custom?: boolean;
}
