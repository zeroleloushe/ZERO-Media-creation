import type { EditState, H3State, KreaState, UpscaleState } from "./types";
import { computeResolution, type ResInput } from "./resolution";
import {
  buildGenAudioPlan,
  buildGenChunkPlan,
  buildTailExtractPlan,
  continuationPrompt,
  emptyBundle,
  H3_STITCH_FRAMES,
  H3_TAIL_FRAMES,
  mediaToState,
  refsForChunk,
  snapH3Chunk,
} from "./h3-chunks";

type Graph = Record<string, { inputs: Record<string, unknown>; class_type: string; _meta?: { title?: string } }>;
type Link = [string, number];

type UpscalePipe = {
  audio: Link;
  vaeV: Link;
  vaeA: Link;
  clip: Link;
  model: Link;
  refs: string;
  picturesCount: number;
  seconds: number;
  savePrefix: string;
};

async function loadTemplate(name: "h3" | "krea" | "edit"): Promise<Graph> {
  return (await fetch(`/workflows/${name}.json`)).json();
}
function setInput(g: Graph, id: string, key: string, value: unknown) {
  if (!g[id]) return;
  g[id].inputs[key] = value;
}
function stripH3Sampling(g: Graph) {
  for (const [id, n] of Object.entries(g)) {
    if (n.class_type !== "MiniMaxH3SigmaShift" && n.class_type !== "ModelSamplingMiniMaxH3") continue;
    const src = n.inputs.model;
    for (const other of Object.values(g)) {
      for (const [k, v] of Object.entries(other.inputs)) {
        if (Array.isArray(v) && v[0] === id) other.inputs[k] = src;
      }
    }
    delete g[id];
  }
}
function enableLivePreview(g: Graph) {
  for (const n of Object.values(g)) if (n.class_type === "ModelPreviewOverrideKJ" && n.inputs) {
    n.inputs.suppress_default_preview = true;
    if (n.inputs.preview_frames == null) n.inputs.preview_frames = 240;
    if (n.inputs.preview_fps == null) n.inputs.preview_fps = 10;
  }
}
function attachSave(g: Graph, source: Link, prefix: string) {
  if (!g[source[0]]) return;
  g.seamless_save = {
    inputs: {
      filename_prefix: prefix,
      images: source
    },
    class_type: "SaveImage",
    _meta: { title: "Seamless Save" }
  };
}
function sizeOf(input: ResInput) {
  return computeResolution(input);
}
function deleteNodes(g: Graph, ids: string[]) {
  for (const id of ids) delete g[id];
}
function h3Megapixels(raw: unknown, fallback = 1.8) {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Math.min(16, Math.max(0.1, Number.isFinite(n) ? Math.round(n * 10) / 10 : fallback));
}
/**
* V3 DynamicCombo: `mode` is the selected option string; children use dotted ids
* (`mode.megapixels`). A nested dict here gets eaten and execute() loses `mode`.
*/
function minimaxH3UpscalerInputs(latent: Link, model: string, megapixels: number, align: number) {
  const mp = h3Megapixels(megapixels);
  return {
    latent,
    model_name: model,
    mode: "megapixels",
    "mode.megapixels": mp,
    megapixels: mp,
    align,
    enable_chunking: true,
    device: "cuda",
    precision: "fp16"
  };
}
/**
* H3 upscale — the same chain as on the user's canvas (Control Panel
* Pixaroma + MiniMaxSeamlessChunks + Minimax H3 Latent Upscaler 3D).
* Pixaroma Group Switch / Chunk Num are frontend-only, so the API prompt
* includes those nodes directly instead of mute-toggles.
*
* Control Panel values we copy:
*   denoise, mode=megapixels, megapixels, num chunks. CLIP stays off.
*/
function applyH3Upscale(g: Graph, h3: H3State, _up: ReturnType<typeof computeResolution>) {
  const n = Math.max(1, Math.min(4, Math.round(h3.chunks) || 2));
  const mp = h3.megapixels ?? 1.8;
  const denoise = h3.denoise ?? 0.25;
  const align = h3.upscaleSnap || 32;
  if (g["832"]) g["832"]._meta = { title: h3.upscale ? `Chunk Num · 1–${n}` : "Chunk Num" };
  if (g["153"]) g["153"]._meta = { title: h3.upscale ? "Group Switch · Upscale ON" : "Group Switch Pixaroma" };
  deleteNodes(g, ["664"]);
  if (!h3.upscale) {
    deleteNodes(g, ["792", "150:973"]);
    return;
  }
  g.h3_up_latent = {
    inputs: minimaxH3UpscalerInputs(["150:973", 0], h3.upscaleModel && h3.upscaleModel !== "auto" ? h3.upscaleModel : "minimax_h3_latent_upscaler_3d_bf16.safetensors", mp, align),
    class_type: "MinimaxH3LatentUpscaler3D",
    _meta: { title: "Minimax H3 Latent Upscaler (3D)" }
  };
  g.h3_up_sigmas = {
    inputs: {
      scheduler: h3.scheduler,
      steps: Math.max(4, Math.round(h3.steps)),
      denoise,
      model: ["637", 0]
    },
    class_type: "BasicScheduler",
    _meta: { title: "Upscale sigmas" }
  };
  let sampled = ["h3_up_sample1", 0];
  if (n <= 1) g.h3_up_sample1 = {
    inputs: {
      noise: ["150:129", 0],
      guider: ["150:126", 0],
      sampler: ["150:638", 0],
      sigmas: ["h3_up_sigmas", 0],
      latent_image: ["h3_up_latent", 0]
    },
    class_type: "SamplerCustomAdvanced",
    _meta: { title: "Chunk 1" }
  };
  else {
    g.h3_up_split = {
      inputs: {
        latent: ["h3_up_latent", 0],
        num_chunks: n,
        overlap_frames: 5,
        align_h3_grid: true,
        pad_multiple: 5,
        pad_remainder: 2
      },
      class_type: "MMH3_LatentChunkSplitter",
      _meta: { title: "MMH3 Latent Chunk Splitter" }
    };
    const mergeInputs: Record<string, unknown> = {
      plan: ["h3_up_split", 5],
      blend_mode: "smoothstep"
    };
    for (let i = 1; i <= n; i++) {
      const id = `h3_up_sample${i}`;
      g[id] = {
        inputs: {
          noise: ["150:129", 0],
          guider: ["150:126", 0],
          sampler: ["150:638", 0],
          sigmas: ["h3_up_sigmas", 0],
          latent_image: ["h3_up_split", i - 1]
        },
        class_type: "SamplerCustomAdvanced",
        _meta: { title: `Chunk ${i}` }
      };
      mergeInputs[`latent_chunk_${i}`] = [id, 0];
    }
    g.h3_up_merge = {
      inputs: mergeInputs,
      class_type: "MMH3_LatentChunkMerge",
      _meta: { title: "MMH3 Latent Chunk Merge" }
    };
    sampled = ["h3_up_merge", 0];
  }
  g.h3_up_decode = {
    inputs: {
      samples: sampled,
      vae: ["150:119", 0]
    },
    class_type: "VAEDecode",
    _meta: { title: "Декодировать VAE" }
  };
  if (g["792"]) {
    g["792"].inputs.video_frames = ["h3_up_decode", 0];
    g["792"].inputs.audio = ["150:121", 0];
    g["792"].inputs.filename_prefix = "zero/h3-up";
  } else g["792"] = {
    inputs: {
      fps: 24,
      filename_prefix: "zero/h3-up",
      save_mode: "save",
      trim_to_audio: false,
      audio_fade_ms: 0,
      video_frames: ["h3_up_decode", 0],
      audio: ["150:121", 0]
    },
    class_type: "PixaromaSaveMp4",
    _meta: { title: "Save Mp4 upscale" }
  };
  delete g["269"];
}
function applyH3ChunkGen(g: Graph, h3: H3State) {
  const n = Math.max(2, Math.min(5, Math.round(h3.chunkCount) || 3));
  const snapped = snapH3Chunk(h3.chunkSec || 8);
  const tail = H3_TAIL_FRAMES;
  const stitch = H3_STITCH_FRAMES;
  const plan = buildGenChunkPlan(n, snapped.frames, stitch);
  const audioPlan = buildGenAudioPlan(plan);
  const tailPlan = buildTailExtractPlan(snapped.frames, tail);
  const prompts = [...(h3.chunkPrompts ?? ["", "", "", "", ""])];
  if (!prompts[0]?.trim()) prompts[0] = h3.prompt;

  g.c_plan = {
    inputs: { value: JSON.stringify(plan) },
    class_type: "PrimitiveStringMultiline",
    _meta: { title: "MMH3 chunk plan · stitch 2f" },
  };
  g.c_aplan = {
    inputs: { value: JSON.stringify(audioPlan) },
    class_type: "PrimitiveStringMultiline",
    _meta: { title: "MMH3 audio plan · stitch 2f" },
  };
  g.c_tail_plan = {
    inputs: { value: JSON.stringify(tailPlan) },
    class_type: "PrimitiveStringMultiline",
    _meta: { title: "Audio tail plan · 22f history" },
  };

  // Pixel tail (IMAGE) + sample-accurate audio tail for <Video 1> history.
  g.c1_tail = {
    inputs: { images: ["150:122", 0], count: tail },
    class_type: "MMH3_LastFrames",
    _meta: { title: "Tail 22 · chunk 1 · Video 1" },
  };
  g.c1_last = {
    inputs: { images: ["150:122", 0], count: 1 },
    class_type: "MMH3_LastFrames",
    _meta: { title: "Last frame · chunk 1 · Picture 1" },
  };
  g.c1_atail = {
    inputs: { audio: ["150:121", 0], plan: ["c_tail_plan", 0] },
    class_type: "MMH3_AudioChunkSplitter",
    _meta: { title: "Audio tail · chunk 1 · Audio 1" },
  };

  const img: [string, number][] = [["150:122", 0]];
  const aud: [string, number][] = [["150:121", 0]];
  let prevTail: [string, number] = ["c1_tail", 0];
  let prevLast: [string, number] = ["c1_last", 0];
  let prevAudioTail: [string, number] = ["c1_atail", 1];

  for (let i = 2; i <= n; i++) {
    const bundle = refsForChunk(h3, i - 1);
    const perChunk = h3.refMode === "per_chunk";
    const split = perChunk ? `c${i}_refs` : "150:737";

    if (perChunk) {
      g[`c${i}_media`] = {
        inputs: {
          media_state: JSON.stringify(mediaToState(bundle)),
          "Open loader…": null,
          "+ Native-output splitter": null,
        },
        class_type: "MiniMaxH3MediaLoader",
        _meta: { title: `Refs · chunk ${i}` },
      };
      g[`c${i}_refs`] = {
        inputs: { references: [`c${i}_media`, 0] },
        class_type: "MiniMaxH3ReferenceSplitter",
      };
    }

    g[`c${i}_prompt`] = {
      inputs: { value: continuationPrompt(prompts[i - 1] || "") },
      class_type: "PrimitiveStringMultiline",
      _meta: { title: `Prompt · chunk ${i}` },
    };

    const inputs: Record<string, unknown> = {
      prompt: [`c${i}_prompt`, 0],
      width: ["143", 0],
      height: ["143", 1],
      length: ["629", 0],
      ref_image_size: "max",
      clip: ["150:128", 0],
      vae: ["150:119", 0],
      audio_vae: ["150:120", 0],
    };
    // <Picture 1> = last frame of previous clip (exact 0.00s state).
    // User pictures shift to <Picture 2>+  → first user still is identity.
    inputs["ref_images.ref_image_0"] = prevLast;
    for (let k = 0; k < 8; k++) inputs[`ref_images.ref_image_${k + 1}`] = [split, k];
    // <Video 1> is always the previous 22-frame tail (+ matching audio).
    // User videos shift to <Video 2> / <Video 3>.
    inputs["ref_videos.ref_video_0"] = prevTail;
    inputs["ref_videos.ref_video_1"] = [split, 9];
    inputs["ref_videos.ref_video_2"] = [split, 10];
    inputs["ref_video_audios.ref_video_audio_0"] = prevAudioTail;
    inputs["ref_video_audios.ref_video_audio_1"] = [split, 12];
    inputs["ref_video_audios.ref_video_audio_2"] = [split, 13];
    // <Audio 1> = same tail so the continuation prompt token resolves.
    // User audios shift to <Audio 2> / <Audio 3>.
    inputs["ref_audios.ref_audio_0"] = prevAudioTail;
    inputs["ref_audios.ref_audio_1"] = [split, 16];
    inputs["ref_audios.ref_audio_2"] = [split, 17];

    g[`c${i}_r2v`] = {
      inputs,
      class_type: "MiniMaxH3ReferenceToVideo",
      _meta: { title: `H3 R2V · chunk ${i}` },
    };
    g[`c${i}_guide`] = {
      inputs: { model: ["622", 0], conditioning: [`c${i}_r2v`, 0] },
      class_type: "BasicGuider",
    };
    g[`c${i}_seed`] = {
      inputs: { seed: h3.seed + i - 1, SeedState: JSON.stringify({ runSeed: h3.seed + i - 1 }) },
      class_type: "PixaromaSeed",
    };
    g[`c${i}_noise`] = {
      inputs: { noise_seed: [`c${i}_seed`, 0] },
      class_type: "RandomNoise",
    };
    g[`c${i}_sample`] = {
      inputs: {
        noise: [`c${i}_noise`, 0],
        guider: [`c${i}_guide`, 0],
        sampler: ["150:638", 0],
        sigmas: ["150:124", 0],
        latent_image: [`c${i}_r2v`, 1],
      },
      class_type: "SamplerCustomAdvanced",
      _meta: { title: `Sampler · chunk ${i}` },
    };
    g[`c${i}_dec`] = {
      inputs: { samples: [`c${i}_sample`, 0], vae: ["150:119", 0] },
      class_type: "VAEDecode",
      _meta: { title: `Decode · chunk ${i}` },
    };
    g[`c${i}_aud`] = {
      inputs: { samples: [`c${i}_sample`, 0], vae: ["150:120", 0] },
      class_type: "VAEDecodeAudio",
    };
    img.push([`c${i}_dec`, 0]);
    aud.push([`c${i}_aud`, 0]);
    if (i < n) {
      g[`c${i}_tail`] = {
        inputs: { images: [`c${i}_dec`, 0], count: tail },
        class_type: "MMH3_LastFrames",
        _meta: { title: `Tail 22 · chunk ${i} · Video 1` },
      };
      g[`c${i}_last`] = {
        inputs: { images: [`c${i}_dec`, 0], count: 1 },
        class_type: "MMH3_LastFrames",
        _meta: { title: `Last frame · chunk ${i} · Picture 1` },
      };
      g[`c${i}_atail`] = {
        inputs: { audio: [`c${i}_aud`, 0], plan: ["c_tail_plan", 0] },
        class_type: "MMH3_AudioChunkSplitter",
        _meta: { title: `Audio tail · chunk ${i} · Audio 1` },
      };
      prevTail = [`c${i}_tail`, 0];
      prevLast = [`c${i}_last`, 0];
      prevAudioTail = [`c${i}_atail`, 1];
    }
  }

  const mergeImg: Record<string, unknown> = {
    plan: ["c_plan", 0],
    blend_mode: "smoothstep",
    chunk_1: img[0],
  };
  img.forEach((c, i) => {
    if (i > 0) mergeImg[`chunk_${i + 1}`] = c;
  });
  g.c_merge = {
    inputs: mergeImg,
    class_type: "MMH3_ChunkMerge",
    _meta: { title: "Склейка кадров · smoothstep 2f" },
  };

  const mergeAud: Record<string, unknown> = {
    audio_plan: ["c_aplan", 0],
    blend_mode: "equal_power",
    audio_chunk_1: aud[0],
  };
  aud.forEach((c, i) => {
    if (i > 0) mergeAud[`audio_chunk_${i + 1}`] = c;
  });
  g.c_amerge = {
    inputs: mergeAud,
    class_type: "MMH3_AudioChunkMerge",
    _meta: { title: "Склейка аудио · equal_power 2f" },
  };

  if (g["269"]) {
    g["269"].inputs.video_frames = ["c_merge", 0];
    g["269"].inputs.audio = ["c_amerge", 0];
    g["269"].inputs.filename_prefix = "zero/h3-chunks";
  }
}

function applyKreaUpscale(g: Graph, krea: KreaState) {
  if (!krea.upscale) return;
  const mp = krea.upscaleMp ?? 6;
  const snap = krea.upscaleSnap ?? 16;
  const denoise = krea.denoise ?? 0.28;
  g.krea_up_resize = {
    inputs: {
      image: ["30:8", 0],
      ImageResizeState: JSON.stringify({
        mode: "max_mp",
        max_mp: mp,
        longest_side: 1024,
        scale_factor: 1,
        fit_w: 1024,
        fit_h: 1024,
        cover_w: 1024,
        cover_h: 1024,
        ratio_preset: "1:1",
        ratio_w: 1,
        ratio_h: 1,
        ratio_action: "crop",
        pad_color: "#808080",
        pad_top: 0,
        pad_bottom: 0,
        pad_left: 0,
        pad_right: 0,
        crop_anchor: "center",
        crop_scale: true,
        snap,
        resample: "auto",
        allow_upscale: true
      })
    },
    class_type: "PixaromaImageResize",
    _meta: { title: "Image Resize Pixaroma" }
  };
  g.krea_up_model = {
    inputs: { model_name: "4x-UltraSharp.pth" },
    class_type: "UpscaleModelLoader",
    _meta: { title: "Krea upscale model" }
  };
  g.krea_up_neg = {
    inputs: {
      text: "jpeg compression, scribbles, AI generated, shredded cloth",
      clip: ["30:11", 0]
    },
    class_type: "CLIPTextEncode",
    _meta: { title: "Krea upscale negative" }
  };
  g.krea_up_tile = {
    inputs: {
      seed: ["252", 0],
      sampler_name: "exp_heun_2_x0_sde",
      scheduler: "linear_quadratic",
      steps: 4,
      cfg: 1,
      denoise,
      upscale_by: 1,
      max_tile_width: ["krea_up_resize", 2],
      max_tile_height: ["krea_up_resize", 3],
      context_anchor: 256,
      context_overlap: 32,
      image: ["krea_up_resize", 0],
      model: ["245", 0],
      clip: ["30:11", 0],
      vae: ["30:12", 0],
      upscale_model: ["krea_up_model", 0],
      negative: ["krea_up_neg", 0]
    },
    class_type: "ContextAnchoredTileUpscaleVL",
    _meta: { title: "Krea full-frame upscale" }
  };
}
export async function buildH3Graph(h3: H3State): Promise<Graph> {
  const g = await loadTemplate("h3");
  const size = sizeOf({
    ratio: h3.ratio,
    megapixels: h3.genMp ?? 0.7,
    snap: h3.snap ?? 32,
    resMode: h3.resMode ?? "preset",
    customW: h3.customW,
    customH: h3.customH,
    customRw: h3.customRw,
    customRh: h3.customRh
  });
  const up = sizeOf({
    ratio: h3.ratio,
    megapixels: h3.megapixels,
    snap: h3.upscaleSnap ?? 32,
    resMode: h3.resMode === "custom_res" ? "custom_ratio" : h3.resMode ?? "preset",
    customW: h3.customW,
    customH: h3.customH,
    customRw: h3.resMode === "custom_res" ? h3.customW : h3.customRw,
    customRh: h3.resMode === "custom_res" ? h3.customH : h3.customRh
  });
  setInput(g, "138", "value", h3.genMode === "chunks" ? h3.chunkPrompts?.[0] || h3.prompt : h3.prompt);
  setInput(g, "156", "switch", h3.llm);
  setInput(g, "143", "ResolutionState", JSON.stringify({
    mode: h3.resMode === "custom_res" ? "custom_resolution" : h3.resMode === "custom_ratio" ? "custom_ratio" : "preset",
    ratio: h3.ratio,
    w: size.w,
    h: size.h,
    custom_w: h3.customW,
    custom_h: h3.customH,
    custom_ratio_w: h3.customRw ?? 21,
    custom_ratio_h: h3.customRh ?? 9,
    snap: h3.snap ?? 32,
    megapixels: h3.genMp ?? 0.7
  }));
  setInput(g, "629", "DurationState", JSON.stringify({
    seconds: h3.genMode === "chunks" ? snapH3Chunk(h3.chunkSec || 8).seconds : h3.duration,
    fps: 24,
    step: 17,
    plus: 5,
    minFrames: 5,
    mode: "recipe",
    formula: ""
  }));
  setInput(g, "266", "seed", h3.seed);
  setInput(g, "266", "SeedState", JSON.stringify({ runSeed: h3.seed }));
  setInput(g, "150:124", "steps", h3.steps);
  setInput(g, "150:124", "scheduler", h3.scheduler);
  setInput(g, "150:638", "sampler_name", h3.sampler);
  setInput(g, "150:127", "unet_name", h3.unet || "h3ErosMax_beta3.safetensors");
  const vision = refsForChunk(h3, 0).pictures[0];
  if (h3.llm) {
    if (vision) g.h3_llm_image = {
      inputs: { image: vision.name },
      class_type: "LoadImage",
      _meta: { title: "LLM vision" }
    };
    g.h3_llm = {
      inputs: {
        model: h3.llmModel,
        mmproj: h3.mmproj,
        system_prompt: h3.systemPrompt,
        prompt: ["138", 0],
        max_tokens: 8500,
        temperature: 0.7,
        top_p: 0.95,
        top_k: 20,
        repeat_penalty: 1.05,
        ctx_size: 8192,
        memory_mode: "gpu_and_cpu_moe_layers",
        n_gpu_layers: 999,
        n_cpu_moe_layers: 22,
        seed: h3.seedLlm,
        timeout_seconds: 300,
        reasoning: h3.reasoning,
        enable_processing: true,
        extra_args: "",
        ...vision ? { image: ["h3_llm_image", 0] } : {}
      },
      class_type: "LLMTextProcessor",
      _meta: { title: "Prompt Enhancer" }
    };
    setInput(g, "156", "on_true", ["h3_llm", 0]);
    setInput(g, "156", "switch", true);
  }
  const media = mediaToState(h3.genMode === "chunks" && h3.refMode === "per_chunk" ? h3.chunkRefs?.[0] ?? emptyBundle() : {
    pictures: h3.pictures,
    videos: h3.videos,
    audios: h3.audios
  });
  setInput(g, "735", "media_state", JSON.stringify(media));
  if (g["150:136"]) g["150:136"].inputs["ref_audios.ref_audio_2"] = ["150:737", 15];
  delete g["743"];
  delete g["150:761"];
  const loraState = {
    version: 1,
    sep: ", ",
    cacheMode: "last",
    loras: h3.loras.map((l) => ({
      name: l.file,
      on: l.on,
      sm: l.strength,
      sc: l.strength,
      triggers: []
    }))
  };
  setInput(g, "637", "LoraLoaderState", JSON.stringify(loraState));
  if (h3.genMode === "chunks") {
    deleteNodes(g, [
      "664",
      "150:973",
      "792"
    ]);
    applyH3ChunkGen(g, h3);
  } else applyH3Upscale(g, h3, up);
  stripH3Sampling(g);
  enableLivePreview(g);
  return g;
}
export async function buildKreaGraph(krea: KreaState): Promise<Graph> {
  const g = await loadTemplate("krea");
  const size = sizeOf({
    ratio: krea.ratio,
    megapixels: krea.megapixels ?? 2,
    snap: krea.snap ?? 64,
    resMode: krea.resMode ?? "preset",
    customW: krea.customW,
    customH: krea.customH,
    customRw: krea.customRw,
    customRh: krea.customRh
  });
  setInput(g, "52", "text", krea.prompt);
  setInput(g, "231", "text", krea.extraPrompt);
  setInput(g, "84", "text", krea.triggerWords);
  setInput(g, "51", "ResolutionState", JSON.stringify({
    mode: krea.resMode === "custom_res" ? "custom_resolution" : krea.resMode === "custom_ratio" ? "custom_ratio" : "preset",
    ratio: krea.ratio,
    w: size.w,
    h: size.h,
    custom_w: krea.customW,
    custom_h: krea.customH,
    custom_ratio_w: krea.customRw ?? 2,
    custom_ratio_h: krea.customRh ?? 3,
    snap: krea.snap ?? 64,
    megapixels: krea.megapixels ?? 2
  }));
  setInput(g, "252", "seed", krea.seedImage);
  setInput(g, "252", "SeedState", JSON.stringify({ runSeed: krea.seedImage }));
  setInput(g, "251", "seed", krea.seedLlm);
  setInput(g, "251", "SeedState", JSON.stringify({ runSeed: krea.seedLlm }));
  setInput(g, "241", "SlidersState", JSON.stringify({
    version: 1,
    sliders: [
      {
        type: "toggle",
        value: krea.llmEnhance ? 1 : 0,
        out: "bool"
      },
      {
        type: "toggle",
        value: krea.triggerOn ? 1 : 0,
        out: "bool"
      },
      {
        type: "toggle",
        value: krea.extraOn ? 1 : 0,
        out: "bool"
      },
      {
        type: "toggle",
        value: krea.loraOn ? 1 : 0,
        out: "bool"
      },
      {
        type: "combo",
        value: krea.reasoning
      },
      {
        type: "combo",
        value: krea.systemPrompt
      }
    ]
  }));
  setInput(g, "244", "SlidersState", JSON.stringify({
    version: 1,
    sliders: [
      {
        type: "combo",
        value: krea.llmModel
      },
      {
        type: "combo",
        value: krea.mmproj
      },
      {
        type: "combo",
        value: krea.unet
      },
      {
        type: "int",
        value: krea.steps
      },
      {
        type: "combo",
        value: krea.sampler
      },
      {
        type: "combo",
        value: krea.scheduler
      }
    ]
  }));
  if (krea.loadImage) setInput(g, "56", "image", krea.loadImage.name);
  setInput(g, "30:133", "enable_processing", krea.llmEnhance);
  if (!krea.llmEnhance) {
    if (g["30:24"]) g["30:24"].inputs.value = false;
    setInput(g, "30:21", "on_true", ["30:19", 0]);
    setInput(g, "30:21", "on_false", ["30:19", 0]);
    delete g["30:133"];
    delete g["144"];
    delete g["30:17"];
    delete g["56"];
  } else if (g["30:24"]) g["30:24"].inputs.value = true;
  const model = g["250"];
  if (model) {
    for (const key of Object.keys(model.inputs)) if (/^lora_\d+$/.test(key)) delete model.inputs[key];
    krea.loras.filter((l) => l.file).forEach((l, i) => {
      model.inputs[`lora_${i + 1}`] = {
        on: Boolean(krea.loraOn && l.on),
        lora: l.file,
        strength: l.strength
      };
    });
  }
  if (krea.llmEnhance && g["56"]?.inputs) try {
    const st = JSON.parse(String(g["56"].inputs.LoadImagePixState || "{}"));
    st.orig_name = krea.loadImage?.name || st.orig_name;
    g["56"].inputs.LoadImagePixState = JSON.stringify(st);
  } catch {}
  applyKreaUpscale(g, krea);
  attachSave(g, krea.upscale && g.krea_up_tile ? ["krea_up_tile", 0] : ["30:8", 0], "seamless/krea");
  enableLivePreview(g);
  return g;
}
export async function buildEditGraph(edit: EditState): Promise<Graph> {
  const g = await loadTemplate("edit");
  const size = sizeOf({
    ratio: edit.ratio,
    megapixels: edit.megapixels ?? 1,
    snap: edit.snap ?? 64,
    resMode: edit.resMode ?? "preset",
    customW: edit.customW,
    customH: edit.customH,
    customRw: edit.customRw,
    customRh: edit.customRh
  });
  setInput(g, "118", "text", edit.prompt);
  setInput(g, "120", "ResolutionState", JSON.stringify({
    mode: edit.resMode === "custom_res" ? "custom_resolution" : edit.resMode === "custom_ratio" ? "custom_ratio" : "preset",
    ratio: edit.ratio,
    w: size.w,
    h: size.h,
    custom_w: edit.customW,
    custom_h: edit.customH,
    custom_ratio_w: edit.customRw ?? 9,
    custom_ratio_h: edit.customRh ?? 16,
    snap: edit.snap ?? 64,
    megapixels: edit.megapixels ?? 1
  }));
  setInput(g, "121", "seed", edit.seed);
  setInput(g, "121", "SeedState", JSON.stringify({ runSeed: edit.seed }));
  setInput(g, "330", "SlidersState", JSON.stringify({
    version: 1,
    sliders: [{
      type: "toggle",
      value: edit.matchSource ? 1 : 0,
      out: "bool"
    }, {
      type: "toggle",
      value: 0,
      out: "bool"
    }]
  }));
  if (edit.image1) setInput(g, "114", "image", edit.image1.name);
  if (edit.image2) {
    g["115"] = {
      inputs: { image: edit.image2.name },
      class_type: "LoadImage",
      _meta: { title: "Изображение 2 (карта)" }
    };
    setInput(g, "111:84", "image_b", ["115", 0]);
    setInput(g, "111:85", "image_b", ["115", 0]);
  } else {
    if (g["111:84"]?.inputs) delete g["111:84"].inputs.image_b;
    if (g["111:85"]?.inputs) delete g["111:85"].inputs.image_b;
    delete g["115"];
  }
  const loraState = {
    version: 1,
    sep: ", ",
    cacheMode: "last",
    loras: edit.loras.filter((l) => !l.hidden).map((l) => ({
      name: l.file,
      on: l.on,
      sm: l.strength,
      sc: l.strength,
      triggers: []
    }))
  };
  setInput(g, "117", "LoraLoaderState", JSON.stringify(loraState));
  if (!edit.upscale) {
    for (const id of Object.keys(g)) if (id.startsWith("264:") || id === "261" || id === "265" || id === "266" || id === "267" || id === "268") delete g[id];
  } else {
    if (g["264:325"]) g["264:325"].inputs.value = edit.upscaleBy;
    if (g["264:311"]) g["264:311"].inputs.denoise = edit.denoise;
  }
  attachSave(g, edit.upscale && g["264:311"] ? ["264:311", 0] : ["111:54", 0], "seamless/edit");
  enableLivePreview(g);
  return g;
}
export function composeKreaPrompt(krea: KreaState) {
  const parts = [];
  if (krea.extraOn && krea.extraPrompt.trim()) parts.push(krea.extraPrompt.trim());
  if (krea.triggerOn && krea.triggerWords.trim()) parts.push(krea.triggerWords.trim());
  if (krea.prompt.trim()) parts.push(krea.prompt.trim());
  return parts.join(", ");
}
function h3TokensFromSeconds(seconds: number) {
  const frames = snapH3Chunk(seconds).frames;
  return 5 * Math.round((frames - 5) / 17) + 2;
}
function h3ChunkTokens(total: number, chunks: number) {
  const raw = Math.ceil(total / chunks) + 5;
  return 5 * Math.max(1, Math.ceil((raw - 2) / 5)) + 2;
}
function attachUpscaleSampler(g: Graph, u: UpscaleState, size: ReturnType<typeof computeResolution>, pipe: UpscalePipe) {
  const n = Math.max(1, Math.min(4, Math.round(u.chunks) || 2));
  const chunkLen = h3ChunkTokens(h3TokensFromSeconds(pipe.seconds), n);
  const denoise = u.denoise ?? 0.25;
  const steps = Math.max(2, Math.round(u.steps) || 4);
  g.prompt = {
    inputs: { value: (u.prompt || "").trim() },
    class_type: "PrimitiveStringMultiline",
    _meta: { title: "Промпт" }
  };
  g.seed = {
    inputs: {
      seed: u.seed,
      SeedState: JSON.stringify({ runSeed: u.seed })
    },
    class_type: "PixaromaSeed"
  };
  g.noise = {
    inputs: { noise_seed: ["seed", 0] },
    class_type: "RandomNoise"
  };
  g.sampler = {
    inputs: { sampler_name: u.sampler || "euler" },
    class_type: "KSamplerSelect"
  };
  g.sched = {
    inputs: {
      scheduler: u.scheduler || "beta",
      steps,
      denoise,
      model: pipe.model
    },
    class_type: "BasicScheduler",
    _meta: { title: "Upscale sigmas" }
  };
  function wireRefs(extra?: Link) {
    const inputs: Record<string, unknown> = {
      prompt: ["prompt", 0],
      width: size.w,
      height: size.h,
      length: chunkLen,
      ref_image_size: "max",
      clip: pipe.clip,
      vae: pipe.vaeV,
      audio_vae: pipe.vaeA
    };
    for (let i = 0; i < 9; i++) inputs[`ref_images.ref_image_${i}`] = [pipe.refs, i];
    for (let i = 0; i < 3; i++) inputs[`ref_videos.ref_video_${i}`] = [pipe.refs, 9 + i];
    for (let i = 0; i < 3; i++) inputs[`ref_video_audios.ref_video_audio_${i}`] = [pipe.refs, 12 + i];
    inputs["ref_audios.ref_audio_0"] = [pipe.refs, 16];
    inputs["ref_audios.ref_audio_1"] = [pipe.refs, 17];
    inputs["ref_audios.ref_audio_2"] = [pipe.refs, 15];
    if (extra) {
      const slot = Math.min(pipe.picturesCount, 8);
      inputs[`ref_images.ref_image_${slot}`] = extra;
    }
    return inputs;
  }
  const sampled = [];
  if (n <= 1) {
    g.r2v1 = {
      inputs: wireRefs(),
      class_type: "MiniMaxH3ReferenceToVideo",
      _meta: { title: "H3 Ref to Video · 1" }
    };
    g.guide1 = {
      inputs: {
        model: pipe.model,
        conditioning: ["r2v1", 0]
      },
      class_type: "BasicGuider"
    };
    g.aenc1 = {
      inputs: {
        audio: pipe.audio,
        vae: pipe.vaeA
      },
      class_type: "VAEEncodeAudio"
    };
    g.concat1 = {
      inputs: {
        video_latent: ["up", 0],
        audio_latent: ["aenc1", 0]
      },
      class_type: "LTXVConcatAVLatent"
    };
    g.sample1 = {
      inputs: {
        noise: ["noise", 0],
        guider: ["guide1", 0],
        sampler: ["sampler", 0],
        sigmas: ["sched", 0],
        latent_image: ["concat1", 0]
      },
      class_type: "SamplerCustomAdvanced",
      _meta: { title: "Chunk 1" }
    };
    g.sep1 = {
      inputs: { av_latent: ["sample1", 0] },
      class_type: "LTXVSeparateAVLatent"
    };
    sampled.push(["sep1", 0]);
  } else {
    g.split = {
      inputs: {
        latent: ["up", 0],
        num_chunks: n,
        overlap_frames: 5,
        align_h3_grid: true,
        pad_multiple: 5,
        pad_remainder: 2
      },
      class_type: "MMH3_LatentChunkSplitter",
      _meta: { title: "Latent Chunk Splitter" }
    };
    g.asplit = {
      inputs: {
        audio: pipe.audio,
        plan: ["split", 5]
      },
      class_type: "MMH3_AudioChunkSplitter",
      _meta: { title: "Audio Chunk Splitter" }
    };
    const mergeInputs: Record<string, unknown> = {
      plan: ["split", 5],
      blend_mode: "smoothstep"
    };
    for (let i = 1; i <= n; i++) {
      const extra: Link | undefined = i > 1 ? [`last${i - 1}`, 0] : undefined;
      g[`r2v${i}`] = {
        inputs: wireRefs(extra),
        class_type: "MiniMaxH3ReferenceToVideo",
        _meta: { title: `H3 Ref to Video · ${i}` }
      };
      g[`guide${i}`] = {
        inputs: {
          model: pipe.model,
          conditioning: [`r2v${i}`, 0]
        },
        class_type: "BasicGuider"
      };
      g[`aenc${i}`] = {
        inputs: {
          audio: ["asplit", i - 1],
          vae: pipe.vaeA
        },
        class_type: "VAEEncodeAudio"
      };
      g[`concat${i}`] = {
        inputs: {
          video_latent: ["split", i - 1],
          audio_latent: [`aenc${i}`, 0]
        },
        class_type: "LTXVConcatAVLatent"
      };
      g[`sample${i}`] = {
        inputs: {
          noise: ["noise", 0],
          guider: [`guide${i}`, 0],
          sampler: ["sampler", 0],
          sigmas: ["sched", 0],
          latent_image: [`concat${i}`, 0]
        },
        class_type: "SamplerCustomAdvanced",
        _meta: { title: `Chunk ${i}` }
      };
      g[`sep${i}`] = {
        inputs: { av_latent: [`sample${i}`, 0] },
        class_type: "LTXVSeparateAVLatent"
      };
      mergeInputs[`latent_chunk_${i}`] = [`sep${i}`, 0];
      if (i < n) {
        g[`dec${i}`] = {
          inputs: {
            samples: [`sep${i}`, 0],
            vae: pipe.vaeV
          },
          class_type: "VAEDecode",
          _meta: { title: `Decode chunk ${i}` }
        };
        g[`last${i}`] = {
          inputs: {
            images: [`dec${i}`, 0],
            count: 1
          },
          class_type: "MMH3_LastFrames",
          _meta: { title: `Last frame ${i}` }
        };
      }
    }
    g.merge = {
      inputs: mergeInputs,
      class_type: "MMH3_LatentChunkMerge",
      _meta: { title: "Latent Chunk Merge" }
    };
    sampled.push(["merge", 0]);
  }
  g.decode = {
    inputs: {
      samples: sampled[0],
      vae: pipe.vaeV
    },
    class_type: "VAEDecode",
    _meta: { title: "VAE decode" }
  };
  g.seamless_save = {
    inputs: {
      fps: 24,
      filename_prefix: pipe.savePrefix || "zero/upscale",
      save_mode: "save",
      trim_to_audio: false,
      audio_fade_ms: 0,
      video_frames: ["decode", 0],
      audio: pipe.audio
    },
    class_type: "PixaromaSaveMp4",
    _meta: { title: "Save Mp4" }
  };
}
function upscaleModelName(u: UpscaleState) {
  return u.upscaleModel && u.upscaleModel !== "auto" ? u.upscaleModel : "minimax_h3_latent_upscaler_3d_bf16.safetensors";
}
function attachUpscaleBackbone(g: Graph, u: UpscaleState) {
  g.vaeV = {
    inputs: { vae_name: "minimax_h3_video_vae_int8_convrot.safetensors" },
    class_type: "VAELoader",
    _meta: { title: "H3 video VAE" }
  };
  g.vaeA = {
    inputs: { vae_name: "minimax_h3_audio_vae_fp32.safetensors" },
    class_type: "VAELoader",
    _meta: { title: "H3 audio VAE" }
  };
  g.clip = {
    inputs: {
      clip_name: "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
      type: "minimax",
      device: "default"
    },
    class_type: "CLIPLoader"
  };
  g.unet = {
    inputs: {
      unet_name: u.unet || "h3ErosMax_beta3.safetensors",
      weight_dtype: "default"
    },
    class_type: "UNETLoader"
  };
  g.lora = {
    inputs: {
      model: ["unet", 0],
      LoraLoaderState: JSON.stringify({
        version: 1,
        sep: ", ",
        cacheMode: "last",
        loras: u.loras.map((l) => ({
          name: l.file,
          on: l.on,
          sm: l.strength,
          sc: l.strength,
          triggers: []
        }))
      })
    },
    class_type: "PixaromaLoraLoader"
  };
  g.media = {
    inputs: {
      media_state: JSON.stringify(mediaToState({
        pictures: u.pictures,
        videos: [],
        audios: []
      })),
      "Open loader…": null,
      "+ Native-output splitter": null
    },
    class_type: "MiniMaxH3MediaLoader"
  };
  g.refs = {
    inputs: { references: ["media", 0] },
    class_type: "MiniMaxH3ReferenceSplitter"
  };
}
/**
* Standalone H3 video upscale:
*   load → VAE encode → 3D latent upscale → chunk split
*   → MiniMax sampler per chunk (chunk 2+ gets last frame of previous)
*/
export async function buildUpscaleGraph(u: UpscaleState): Promise<Graph> {
  const g: Graph = {};
  const src = u.source;
  if (!src?.name) throw new Error("Загрузи видео");
  const seconds = Math.max(1, src.trimLength || src.duration || 8);
  const srcW = src.width || 1280;
  const srcH = src.height || 544;
  const size = sizeOf({
    ratio: `${srcW}:${srcH}`,
    megapixels: u.megapixels ?? 1.8,
    snap: u.snap ?? 32,
    resMode: "custom_ratio",
    customRw: srcW,
    customRh: srcH
  });
  const skip = Math.max(0, Math.round((src.trimStart || 0) * 24));
  const cap = src.trimLength ? Math.max(1, Math.round(src.trimLength * 24)) : 0;
  g.load = {
    inputs: {
      video: src.name,
      force_rate: 24,
      custom_width: 0,
      custom_height: 0,
      frame_load_cap: cap,
      skip_first_frames: skip,
      select_every_nth: 1,
      format: "None"
    },
    class_type: "VHS_LoadVideo",
    _meta: { title: "Load video" }
  };
  attachUpscaleBackbone(g, u);
  g.venc = {
    inputs: {
      pixels: ["load", 0],
      vae: ["vaeV", 0]
    },
    class_type: "VAEEncode",
    _meta: { title: "Encode video" }
  };
  g.up = {
    inputs: minimaxH3UpscalerInputs(["venc", 0], upscaleModelName(u), u.megapixels ?? 1.8, u.snap || 32),
    class_type: "MinimaxH3LatentUpscaler3D",
    _meta: { title: "Minimax H3 Latent Upscaler (3D)" }
  };
  attachUpscaleSampler(g, u, size, {
    audio: ["load", 2],
    vaeV: ["vaeV", 0],
    vaeA: ["vaeA", 0],
    clip: ["clip", 0],
    model: ["lora", 0],
    refs: "refs",
    picturesCount: u.pictures.length,
    seconds,
    savePrefix: "zero/upscale"
  });
  enableLivePreview(g);
  return g;
}
/** First-pass H3 latent (node 150:125) → upscaler. Skips VAE encode of the mp4. */
export async function buildH3LatentUpscaleGraph(h3: H3State, u: UpscaleState): Promise<Graph> {
  const g = await buildH3Graph({
    ...h3,
    genMode: "standard",
    upscale: false
  });
  deleteNodes(g, [
    "664",
    "792",
    "269"
  ]);
  if (!g["150:973"]) {
    g["150:973"] = {
      inputs: { av_latent: ["150:125", 0] },
      class_type: "LTXVSeparateAVLatent",
      _meta: { title: "Separate AV · video latent" }
    };
  }
  const size = sizeOf({
    ratio: h3.ratio,
    megapixels: u.megapixels ?? 1.8,
    snap: u.snap ?? 32,
    resMode: h3.resMode === "custom_res" ? "custom_ratio" : h3.resMode ?? "preset",
    customW: h3.customW,
    customH: h3.customH,
    customRw: h3.resMode === "custom_res" ? h3.customW : h3.customRw,
    customRh: h3.resMode === "custom_res" ? h3.customH : h3.customRh
  });
  g.up = {
    inputs: minimaxH3UpscalerInputs(["150:973", 0], upscaleModelName(u), u.megapixels ?? 1.8, u.snap || 32),
    class_type: "MinimaxH3LatentUpscaler3D",
    _meta: { title: "Minimax H3 Latent Upscaler (3D)" }
  };
  attachUpscaleSampler(g, u, size, {
    audio: ["150:121", 0],
    vaeV: ["150:119", 0],
    vaeA: ["150:120", 0],
    clip: ["150:128", 0],
    model: ["637", 0],
    refs: "150:737",
    picturesCount: h3.pictures.length,
    seconds: h3.duration,
    savePrefix: "zero/h3-up"
  });
  enableLivePreview(g);
  return g;
}
